import { expect, it } from "vitest";
import { cloneConfig } from "./schema";
import {
  courseAccess,
  courseGrade,
  lessonAccess,
  orderedCourses,
} from "./access";
import { courses, courseLessons } from "../data/courses";
import { emptyProgress } from "../domain/progress";
it("свободный режим сохраняет доступ ко всем пяти существующим курсам", () => {
  expect(courses).toHaveLength(5);
  for (const c of courses)
    expect(courseAccess(emptyProgress(), c.id).allowed).toBe(true);
});
it("последовательный режим открывает следующий курс после фактического завершения", () => {
  const c = cloneConfig();
  c.access.mode = "sequential";
  const s = emptyProgress();
  expect(courseAccess(s, courses[1].id, c).allowed).toBe(false);
  s.completedLessons = courseLessons(courses[0]);
  expect(courseAccess(s, courses[1].id, c).allowed).toBe(true);
  expect(courseAccess(s, courses[2].id, c).allowed).toBe(false);
});
it("базовый курс открывает остальные одновременно, процент можно уменьшить", () => {
  const c = cloneConfig();
  c.access.mode = "foundation";
  c.access.minCompletion = 50;
  const s = emptyProgress();
  s.completedLessons = courseLessons(courses[0]).slice(0, 5);
  for (const course of courses.slice(1))
    expect(courseAccess(s, course.id, c).allowed).toBe(true);
});
it("балл курса берётся из записанных ответов; старому прогрессу баллы не придумываются", () => {
  const c = cloneConfig();
  c.access.mode = "score";
  c.access.minScore = 95;
  const s = emptyProgress();
  s.completedLessons = courseLessons(courses[0]);
  expect(courseGrade(s, courses[0].id)).toBeNull();
  expect(courseAccess(s, courses[1].id, c).allowed).toBe(false);
  s.lessonAttempts = [
    {
      id: "check-a",
      lessonId: "A1",
      courseId: "analytics",
      answer: 0,
      correct: true,
      updated: new Date().toISOString(),
    },
  ];
  expect(courseAccess(s, courses[1].id, c).allowed).toBe(false);
  s.lessonAttempts = courseLessons(courses[0]).map((id) => ({
    id: "check-" + id,
    lessonId: id,
    courseId: "analytics",
    answer: 0,
    correct: true,
    updated: new Date().toISOString(),
  }));
  expect(courseAccess(s, courses[1].id, c).allowed).toBe(true);
  s.lessonAttempts[0].correct = false;
  expect(courseAccess(s, courses[1].id, c).allowed).toBe(false);
});
it("исключения, порядок и новые курсы не требуют выдуманного каталога", () => {
  const c = cloneConfig();
  c.access.mode = "sequential";
  c.access.courseRules.abtest = "always";
  c.access.courseRules.analytics = "locked";
  expect(courseAccess(emptyProgress(), "abtest", c).allowed).toBe(true);
  expect(courseAccess(emptyProgress(), "analytics", c).allowed).toBe(false);
  c.access.order = ["economics"];
  expect(orderedCourses(c)[0].id).toBe("economics");
  expect(orderedCourses(c).length).toBe(courses.length);
});
it("уроки по порядку и запрет повтора действуют также на прямые ссылки", () => {
  const c = cloneConfig();
  c.lessons.sequential = true;
  const s = emptyProgress();
  expect(lessonAccess(s, "A2", c).allowed).toBe(false);
  s.completedLessons = ["A1"];
  expect(lessonAccess(s, "A2", c).allowed).toBe(true);
  c.lessons.allowRepeat = false;
  expect(lessonAccess(s, "A1", c).allowed).toBe(false);
});
