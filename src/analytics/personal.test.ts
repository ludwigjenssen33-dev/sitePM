import { expect, it } from "vitest";
import { personalReport, heatmapDates } from "./personal";
import type { AnalyticsEvent } from "./events";
let serial = 0;
const now = Date.parse("2026-10-24T12:00:00Z");
const e = (
  type: AnalyticsEvent["type"],
  params: AnalyticsEvent["params"] = {},
): AnalyticsEvent => ({
  id: String(++serial),
  schemaVersion: 1,
  type,
  timestamp: new Date(now).toISOString(),
  actorId: "a",
  sessionId: "s",
  device: "desktop",
  source: "direct",
  mode: "local",
  params,
});
const all = { days: 30, courseId: "all", caseId: "all" };
it("пустые данные не превращаются в демонстрацию", () => {
  const r = personalReport([], all, now);
  expect(r.mean).toBeNull();
  expect(r.activeMs).toBe(0);
  expect(r.sessions).toBe(0);
});
it("повторы доставки и перекрывающиеся интервалы не удваивают время", () => {
  const a = e("active_learning", {
    startMs: now - 10000,
    durationMs: 10000,
    courseId: "analytics",
  });
  const b = e("active_learning", {
    startMs: now - 5000,
    durationMs: 5000,
    courseId: "analytics",
  });
  const r = personalReport([a, a, b], all, now);
  expect(r.activeMs).toBe(10000);
  expect(r.times[0].minutes).toBeCloseTo(1 / 6);
});
it("фильтры периода, курса и кейса используют реальные контексты", () => {
  const list = [
    e("answer_submitted", { lessonId: "A2", correct: 0 }),
    e("case_completed", { caseId: "market", attemptId: "m1", score: 80 }),
    { ...e("page_view"), timestamp: "2026-01-01T00:00:00Z" },
  ];
  expect(personalReport(list, all, now).events).toHaveLength(2);
  expect(
    personalReport(list, { ...all, courseId: "analytics" }, now).events,
  ).toHaveLength(2);
  expect(personalReport(list, { ...all, caseId: "market" }, now).mean).toBe(80);
  expect(
    personalReport(list, { ...all, caseId: "quality" }, now).events,
  ).toHaveLength(0);
});
it("результаты берутся по попыткам, неизвестная правильность не считается успехом", () => {
  const a = e("case_completed", {
    caseId: "market",
    attemptId: "m1",
    score: 80,
  });
  const r = personalReport(
    [
      a,
      e("case_completed", { caseId: "market", attemptId: "m1", score: 80 }),
      e("answer_submitted", { lessonId: "A1" }),
      e("answer_submitted", { lessonId: "A2", correct: 0 }),
    ],
    all,
    now,
  );
  expect(r.attempts).toBe(1);
  expect(r.mean).toBe(80);
  expect(r.answers).toBe(1);
  expect(r.errors).toBe(1);
});
it("календарь содержит реальные даты и нули без синтетической активности", () => {
  const h = heatmapDates(
    [{ date: "2026-10-24", events: 3, activeMs: 1000 }],
    new Date(now),
  );
  expect(h).toHaveLength(182);
  expect(h.filter((d) => d.events > 0)).toHaveLength(1);
  expect(h[h.length - 1].date).toBe("2026-10-24");
});
it("учебное время обрезается по периоду и распределяется по фактическим дням UTC", () => {
  const boundary = Date.parse("2026-10-24T00:00:05Z");
  const a = {
    ...e("active_learning", {
      startMs: boundary - 10000,
      durationMs: 10000,
      courseId: "analytics",
    }),
    timestamp: new Date(boundary).toISOString(),
  };
  const r = personalReport([a], all, boundary);
  expect(r.daily.find((d) => d.date === "2026-10-23")?.activeMs).toBe(5000);
  expect(r.daily.find((d) => d.date === "2026-10-24")?.activeMs).toBe(5000);
  const end = now - 86400000 + 5000;
  const b = {
    ...e("active_learning", { startMs: end - 10000, durationMs: 10000 }),
    timestamp: new Date(end).toISOString(),
  };
  expect(personalReport([b], { ...all, days: 1 }, now).activeMs).toBe(5000);
});
