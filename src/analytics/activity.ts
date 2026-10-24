import { activeSlice, sessionExpired } from "./session";
import {
  analyticsConsent,
  analyticsKeys,
  endExpiredSession,
  readSession,
  touchSession,
  track,
  type EventParams,
} from "./events";
let context: EventParams = {};
let flushCurrent: () => void = () => {};
export function setLearningContext(next: EventParams) {
  flushCurrent();
  context = { ...next };
}
/** Persist only time slices; no key values, pointer coordinates or private field contents. */
export function installActiveLearning() {
  let last = Date.now(),
    wasVisible = document.visibilityState === "visible" && document.hasFocus(),
    stopped = false;
  function flush() {
    const now = Date.now(),
      from = last,
      visible = wasVisible,
      attribution = { ...context };
    last = now;
    const run = () => {
      if (analyticsConsent() !== true) return;
      const session = readSession();
      if (!session || sessionExpired(session, now)) {
        endExpiredSession(now);
        return;
      }
      if (!attribution.lessonId && !attribution.courseId && !attribution.caseId)
        return;
      let watermark = 0;
      try {
        watermark = Number(localStorage.getItem(analyticsKeys.watermark) || 0);
      } catch {
        return;
      }
      const slice = activeSlice(from, now, watermark, session, visible);
      if (slice && slice.duration >= 100) {
        localStorage.setItem(analyticsKeys.watermark, String(slice.end));
        track("active_learning", {
          ...attribution,
          startMs: slice.start,
          durationMs: slice.duration,
        });
      }
    };
    if (navigator.locks)
      void navigator.locks.request("product-lab-active-learning", () => {
        run();
      });
    else run();
  }
  function visibility() {
    flush();
    const visible =
      document.visibilityState === "visible" && document.hasFocus();
    if (
      visible &&
      !wasVisible &&
      (context.lessonId || context.courseId || context.caseId)
    )
      touchSession();
    wasVisible = visible;
    last = Date.now();
  }
  let touched = 0;
  function activity() {
    if (Date.now() - touched < 1000) return;
    touched = Date.now();
    touchSession();
  }
  const timer = setInterval(flush, 10000);
  flushCurrent = flush;
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("focus", visibility);
  window.addEventListener("blur", visibility);
  window.addEventListener("pagehide", visibility);
  for (const name of ["pointerdown", "keydown", "scroll"])
    window.addEventListener(name, activity, { passive: true });
  return () => {
    if (stopped) return;
    stopped = true;
    flush();
    clearInterval(timer);
    flushCurrent = () => {};
    document.removeEventListener("visibilitychange", visibility);
    window.removeEventListener("focus", visibility);
    window.removeEventListener("blur", visibility);
    window.removeEventListener("pagehide", visibility);
    for (const name of ["pointerdown", "keydown", "scroll"])
      window.removeEventListener(name, activity);
  };
}
