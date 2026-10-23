import { analyticsConsent, getEvents } from "./events";
const deliveryKey = "product-lab-analytics-delivered-v1";
let running = false;
let pauseUntil = 0;
function delivered() {
  try {
    return new Set<string>(
      JSON.parse(localStorage.getItem(deliveryKey) || "[]"),
    );
  } catch {
    return new Set<string>();
  }
}
export function analyticsDeliveryState() {
  return {
    configured: true,
    pending:
      analyticsConsent() === true
        ? getEvents().filter((e) => !delivered().has(e.id)).length
        : 0,
  };
}
export async function flushAnalytics() {
  if (running || analyticsConsent() !== true || Date.now() < pauseUntil) return;
  running = true;
  try {
    const sent = delivered();
    const pending = getEvents()
      .filter(
        (e) =>
          !sent.has(e.id) &&
          Date.parse(e.timestamp) > Date.now() - 7 * 86400000,
      )
      .slice(0, 20);
    if (!pending.length) return;
    const r = await fetch("/api/events", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-ProductLab-Request": "1",
      },
      body: JSON.stringify({ consent: true, events: pending }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) {
      if (r.status === 503) pauseUntil = Date.now() + 60000;
      return;
    }
    const result = await r.json();
    if (analyticsConsent() !== true) return;
    const allowed = new Set(pending.map((e) => e.id));
    for (const id of result.accepted || []) if (allowed.has(id)) sent.add(id);
    localStorage.setItem(deliveryKey, JSON.stringify([...sent].slice(-3000)));
  } catch {
    /* Offline never blocks learning. */
  } finally {
    running = false;
  }
}
export function installAnalyticsSync() {
  const run = () => {
    void flushAnalytics();
  };
  window.addEventListener("product-lab:analytics", run);
  window.addEventListener("online", run);
  const timer = setInterval(run, 15000);
  run();
  return () => {
    window.removeEventListener("product-lab:analytics", run);
    window.removeEventListener("online", run);
    clearInterval(timer);
  };
}
