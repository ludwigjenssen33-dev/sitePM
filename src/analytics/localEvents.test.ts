import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  analyticsKeys,
  clearAnalytics,
  endExpiredSession,
  getEvents,
  readSession,
  setAnalyticsConsent,
  touchSession,
  track,
} from "./events";
let data: Map<string, string>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-24T10:00:00Z"));
  data = new Map();
  const storage = {
    getItem: (k: string) => data.get(k) || null,
    setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k),
  };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("sessionStorage", storage);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("повтор React-эффекта не удваивает просмотр и начало урока", () => {
  setAnalyticsConsent(true);
  track("page_view", { route: "/" });
  track("page_view", { route: "/" });
  track("lesson_started", { lessonId: "A1" });
  track("lesson_started", { lessonId: "A1" });
  expect(getEvents().filter((e) => e.type === "page_view")).toHaveLength(1);
  expect(getEvents().filter((e) => e.type === "lesson_started")).toHaveLength(
    1,
  );
  expect(new Set(getEvents().map((e) => e.sessionId)).size).toBe(1);
});
it("30 минут бездействия закрывают старую сессию; следующая активность создаёт новую", () => {
  setAnalyticsConsent(true);
  track("page_view", { route: "/courses" });
  const old = readSession()!.id;
  vi.advanceTimersByTime(30 * 60000);
  endExpiredSession();
  expect(readSession()?.ended).toBe(true);
  touchSession();
  expect(readSession()?.id).not.toBe(old);
  expect(getEvents().filter((e) => e.type === "session_ended")).toHaveLength(1);
});
it("активная метка не продлевает сессию сама по себе", () => {
  setAnalyticsConsent(true);
  track("lesson_started", { lessonId: "A1" });
  const last = readSession()!.last;
  vi.advanceTimersByTime(10000);
  track("active_learning", {
    lessonId: "A1",
    startMs: Date.now() - 10000,
    durationMs: 10000,
  });
  expect(readSession()?.last).toBe(last);
});
it("очистка аналитики и отзыв согласия сохраняют учебный прогресс", () => {
  data.set("product-lab-v2", "keep");
  setAnalyticsConsent(true);
  track("page_view", { route: "/" });
  clearAnalytics();
  expect(getEvents()).toEqual([]);
  expect(data.get("product-lab-v2")).toBe("keep");
  expect(data.has(analyticsKeys.identity)).toBe(false);
  setAnalyticsConsent(false);
  track("page_view");
  expect(getEvents()).toEqual([]);
});
