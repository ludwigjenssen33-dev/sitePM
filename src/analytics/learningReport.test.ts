import { expect, it } from "vitest";
import { learningReport } from "./learningReport";
import type { AnalyticsEvent, EventName, EventParams } from "./events";
let serial = 0;
const e = (type: EventName, params: EventParams = {}): AnalyticsEvent => ({
  id: String(++serial),
  schemaVersion: 1,
  type,
  params,
  actorId: "a",
  sessionId: "s",
  timestamp: new Date().toISOString(),
  mode: "server",
  device: "mobile",
  source: "direct",
});
it("нет данных не превращается в нулевую успешность или средний балл", () => {
  const r = learningReport([]);
  expect(r.mean).toBeNull();
  expect(r.completion).toBeNull();
  expect(r.visitors).toBe(0);
});
it("повторные события не создают новых посетителей, уроков и оценок", () => {
  const start = e("lesson_started", { lessonId: "A1" }),
    finish = e("lesson_completed", { lessonId: "A1" }),
    done = e("case_completed", {
      caseId: "market",
      attemptId: "a1",
      score: 80,
    });
  const r = learningReport([
    start,
    start,
    finish,
    e("lesson_started", { lessonId: "A1" }),
    done,
    e("case_completed", { caseId: "market", attemptId: "a1", score: 80 }),
    e("case_completed", { caseId: "market", attemptId: "a2", score: 100 }),
  ]);
  expect(r.visitors).toBe(1);
  expect(r.sessions).toBe(1);
  expect(r.lessonStarts).toBe(1);
  expect(r.lessonEnds).toBe(1);
  expect(r.completion).toBe(1);
  expect(r.caseEnds).toBe(2);
  expect(r.mean).toBe(90);
});
it("ошибки и подсказки относятся к конкретному заданию", () => {
  const r = learningReport([
    e("answer_submitted", { lessonId: "A2", correct: 0 }),
    e("exercise_error", { lessonId: "A2" }),
    e("hint_used", { caseId: "market", step: 2 }),
    e("course_viewed", { courseId: "analytics" }),
  ]);
  expect(r.tasks.find((t) => t.id === "A2")).toMatchObject({
    answers: 1,
    errors: 1,
  });
  expect(r.tasks.find((t) => t.id === "market:2")?.hints).toBe(1);
  expect(r.courses[0].visitors).toBe(1);
});
