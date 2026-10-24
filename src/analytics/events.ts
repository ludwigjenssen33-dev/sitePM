/** Consent-based personal analytics. This module never sends network requests. */
import { sessionExpired, type SessionClock } from "./session";
export const eventNames = [
  "page_view",
  "session_started",
  "session_ended",
  "signup_started",
  "signup_completed",
  "login_completed",
  "course_viewed",
  "course_transition",
  "lesson_started",
  "lesson_completed",
  "case_started",
  "case_retried",
  "case_completed",
  "hint_used",
  "answer_submitted",
  "experiment_viewed",
  "certificate_issued",
  "payment_clicked",
  "payment_demo_failed",
  "exercise_error",
  "step_transition",
  "active_learning",
] as const;
export type EventName = (typeof eventNames)[number];
export const eventLabels: Record<EventName, string> = {
  page_view: "Просмотр страницы",
  session_started: "Начало сессии",
  session_ended: "Завершение сессии",
  signup_started: "Начало регистрации",
  signup_completed: "Регистрация завершена",
  login_completed: "Вход выполнен",
  course_viewed: "Просмотр курса",
  course_transition: "Переход между курсами",
  lesson_started: "Урок начат",
  lesson_completed: "Урок завершён",
  case_started: "Миссия начата",
  case_retried: "Повтор миссии",
  case_completed: "Миссия завершена",
  hint_used: "Подсказка использована",
  answer_submitted: "Ответ отправлен",
  experiment_viewed: "Эксперимент открыт",
  certificate_issued: "Сертификат получен",
  payment_clicked: "Демо-оплата нажата",
  payment_demo_failed: "Демо-оплата: учебная 404",
  exercise_error: "Ошибка в задании",
  step_transition: "Переход между этапами",
  active_learning: "Активное обучение",
};
export type EventParams = Partial<{
  caseId: string;
  lessonId: string;
  courseId: string;
  fromCourseId: string;
  attemptId: string;
  route: string;
  step: number;
  score: number;
  hints: number;
  durationMs: number;
  variant: number;
  reasonCount: number;
  correct: number;
  startMs: number;
}>;
export type AnalyticsEvent = {
  id: string;
  schemaVersion: 1;
  type: EventName;
  timestamp: string;
  actorId: string;
  sessionId: string;
  device: "mobile" | "desktop" | "unknown";
  source: "direct" | "search" | "social" | "referral" | "unknown";
  params: EventParams;
  mode: "local" | "demo" | "server";
};
export const analyticsKeys = {
  consent: "product-lab-analytics-consent",
  events: "product-lab-events-v1",
  identity: "product-lab-anonymous-id",
  session: "product-lab-session-v2",
  watermark: "product-lab-active-watermark",
};
export const EVENT_LIMIT = 10000;
const safeId = /^[A-Za-z0-9_\-/]{1,80}$/;
const stringKeys = [
  "caseId",
  "lessonId",
  "courseId",
  "fromCourseId",
  "attemptId",
  "route",
];
const numberBounds: Record<string, number> = {
  step: 10,
  score: 100,
  hints: 20,
  durationMs: 86400000,
  variant: 100,
  reasonCount: 7,
  correct: 1,
  startMs: 1e13,
};
export function sanitizeParams(input: unknown): EventParams {
  const out: Record<string, string | number> = {};
  if (!input || typeof input !== "object") return out;
  for (const [key, value] of Object.entries(input)) {
    if (
      stringKeys.includes(key) &&
      typeof value === "string" &&
      safeId.test(value)
    )
      out[key] = value;
    if (
      Object.hasOwn(numberBounds, key) &&
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= numberBounds[key]
    )
      out[key] = Math.round(value);
  }
  return out;
}
export function isAnalyticsEvent(v: unknown): v is AnalyticsEvent {
  if (!v || typeof v !== "object") return false;
  const e = v as AnalyticsEvent;
  return (
    e.schemaVersion === 1 &&
    eventNames.includes(e.type) &&
    typeof e.id === "string" &&
    safeId.test(e.id) &&
    typeof e.actorId === "string" &&
    safeId.test(e.actorId) &&
    typeof e.sessionId === "string" &&
    safeId.test(e.sessionId) &&
    Number.isFinite(Date.parse(e.timestamp)) &&
    ["mobile", "desktop", "unknown"].includes(e.device) &&
    ["direct", "search", "social", "referral", "unknown"].includes(e.source) &&
    ["local", "demo", "server"].includes(e.mode) &&
    !!e.params &&
    JSON.stringify(sanitizeParams(e.params)) === JSON.stringify(e.params)
  );
}
export function analyticsConsent(): boolean | null {
  try {
    const v = localStorage.getItem(analyticsKeys.consent);
    return v === "yes" ? true : v === "no" ? false : null;
  } catch {
    return null;
  }
}
export function clearAnalytics() {
  for (const k of [
    analyticsKeys.events,
    analyticsKeys.identity,
    analyticsKeys.session,
    analyticsKeys.watermark,
    "product-lab-analytics-delivered-v1",
  ])
    localStorage.removeItem(k);
  sessionStorage.removeItem("product-lab-analytics-session");
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("product-lab:analytics"));
}
export function setAnalyticsConsent(enabled: boolean) {
  try {
    localStorage.setItem(analyticsKeys.consent, enabled ? "yes" : "no");
    if (!enabled) clearAnalytics();
    if (typeof window !== "undefined")
      window.dispatchEvent(new Event("product-lab:consent"));
  } catch {
    /* No storage, no collection. */
  }
}
export function getEvents(): AnalyticsEvent[] {
  try {
    const data: unknown = JSON.parse(
      localStorage.getItem(analyticsKeys.events) || "[]",
    );
    return Array.isArray(data)
      ? data
          .filter(isAnalyticsEvent)
          .filter((e) => e.mode === "local")
          .slice(-EVENT_LIMIT)
      : [];
  } catch {
    return [];
  }
}
const uuid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `a-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
function source(): AnalyticsEvent["source"] {
  try {
    if (!document.referrer) return "direct";
    const host = new URL(document.referrer).hostname;
    if (host === location.hostname) return "direct";
    if (/google|yandex|bing|duckduckgo/.test(host)) return "search";
    if (/vk\.|t\.co|facebook|instagram|linkedin/.test(host)) return "social";
    return "referral";
  } catch {
    return "unknown";
  }
}
export function readSession(): SessionClock | null {
  try {
    const raw = JSON.parse(
      localStorage.getItem(analyticsKeys.session) || "null",
    );
    return raw &&
      safeId.test(raw.id) &&
      Number.isFinite(raw.started) &&
      Number.isFinite(raw.last)
      ? raw
      : null;
  } catch {
    return null;
  }
}
export function touchSession(now = Date.now()) {
  if (analyticsConsent() !== true) return;
  const session = readSession();
  if (session && !sessionExpired(session, now))
    localStorage.setItem(
      analyticsKeys.session,
      JSON.stringify({ ...session, last: now }),
    );
  else track("session_started");
}
let lastTrack = new Map<string, number>();
export function track(type: EventName, params: EventParams = {}) {
  if (analyticsConsent() !== true || !eventNames.includes(type)) return;
  try {
    let actorId = localStorage.getItem(analyticsKeys.identity);
    if (!actorId || !safeId.test(actorId)) {
      actorId = uuid();
      localStorage.setItem(analyticsKeys.identity, actorId);
      lastTrack = new Map();
    }
    const now = Date.now();
    const sanitized = sanitizeParams(params);
    const signature = actorId + ":" + type + ":" + JSON.stringify(sanitized);
    const previousCall = lastTrack.get(signature);
    if (
      ["page_view", "course_viewed", "lesson_started"].includes(type) &&
      previousCall !== undefined &&
      now - previousCall < 1000
    )
      return;
    lastTrack.set(signature, now);
    if (lastTrack.size > 200) lastTrack.delete(lastTrack.keys().next().value!);
    let session = readSession();
    if (
      type === "active_learning" &&
      (!session || sessionExpired(session, now))
    )
      return;
    const newSession = !session || sessionExpired(session, now);
    const previous = session;
    if (newSession) session = { id: uuid(), started: now, last: now };
    if (type !== "active_learning" && type !== "session_ended")
      session!.last = now;
    localStorage.setItem(analyticsKeys.session, JSON.stringify(session));
    const base = {
      schemaVersion: 1 as const,
      timestamp: new Date(now).toISOString(),
      actorId,
      sessionId: session!.id,
      device: (typeof matchMedia === "function" &&
      matchMedia("(max-width: 760px)").matches
        ? "mobile"
        : "desktop") as AnalyticsEvent["device"],
      source: source(),
      mode: "local" as const,
    };
    const events = getEvents();
    if (newSession && previous && !previous.ended)
      events.push({
        ...base,
        id: uuid(),
        sessionId: previous.id,
        type: "session_ended",
        params: {},
      });
    if (newSession && type !== "session_started")
      events.push({ ...base, id: uuid(), type: "session_started", params: {} });
    events.push({ ...base, id: uuid(), type, params: sanitized });
    try {
      localStorage.setItem(
        analyticsKeys.events,
        JSON.stringify(events.slice(-EVENT_LIMIT)),
      );
    } catch {
      localStorage.setItem(
        analyticsKeys.events,
        JSON.stringify(events.slice(-Math.floor(EVENT_LIMIT / 2))),
      );
    }
    if (typeof window !== "undefined")
      window.dispatchEvent(new Event("product-lab:analytics"));
  } catch {
    /* Storage and privacy limitations never block education. */
  }
}

export function endExpiredSession(now = Date.now()) {
  try {
    const session = readSession();
    if (
      analyticsConsent() !== true ||
      !session ||
      session.ended ||
      !sessionExpired(session, now)
    )
      return;
    const events = getEvents();
    const last = [...events].reverse().find((e) => e.sessionId === session.id);
    if (last) {
      const at = Math.min(
        now,
        session.last + 30 * 60000,
        session.started + 8 * 3600000,
      );
      events.push({
        ...last,
        id: uuid(),
        type: "session_ended",
        timestamp: new Date(at).toISOString(),
        params: {},
      });
      localStorage.setItem(
        analyticsKeys.events,
        JSON.stringify(events.slice(-EVENT_LIMIT)),
      );
    }
    localStorage.setItem(
      analyticsKeys.session,
      JSON.stringify({ ...session, ended: true }),
    );
    if (typeof window !== "undefined")
      window.dispatchEvent(new Event("product-lab:analytics"));
  } catch {
    /* Optional local statistics must not interrupt education. */
  }
}
