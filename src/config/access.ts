import {
  courses,
  courseLessons,
  courseProgress,
  getCourse,
  locateLesson,
} from "../data/courses";
import type { ProgressState } from "../domain/progress";
import { defaults, type AppConfig } from "./schema";
export function orderedCourses(c: AppConfig = defaults) {
  const order = c.access.order;
  return [...courses].sort((a, b) => {
    const x = order.indexOf(a.id),
      y = order.indexOf(b.id);
    return (
      (x < 0 ? 1000 + courses.indexOf(a) : x) -
      (y < 0 ? 1000 + courses.indexOf(b) : y)
    );
  });
}
export function courseGrade(state: ProgressState, id: string) {
  const course = getCourse(id);
  if (!course) return null;
  const ids = courseLessons(course);
  const results = ids.map(
    (lid) =>
      state.lessonAttempts
        ?.filter((a) => a.lessonId === lid)
        .reduce((best, a) => Math.max(best, a.correct ? 100 : 0), -1) ?? -1,
  );
  const known = results.filter((n) => n >= 0);
  return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
}
export function courseAccess(
  state: ProgressState,
  id: string,
  c: AppConfig = defaults,
) {
  const list = orderedCourses(c),
    index = list.findIndex((x) => x.id === id);
  if (index < 0)
    return { allowed: false, reason: "Курс не найден.", requiredId: null };
  const rule = c.access.courseRules[id];
  if (rule === "locked")
    return {
      allowed: false,
      reason: "Курс закрыт локальной настройкой этого браузера.",
      requiredId: null,
    };
  if (rule === "always" || c.access.mode === "free" || index === 0)
    return { allowed: true, reason: "Курс доступен.", requiredId: null };
  const required = c.access.mode === "foundation" ? list[0] : list[index - 1];
  const p = courseProgress(required, state.completedLessons);
  const grade = courseGrade(state, required.id);
  const complete = p.percent >= c.access.minCompletion;
  const checked = courseLessons(required).filter((id) =>
    state.lessonAttempts?.some((a) => a.lessonId === id),
  ).length;
  const coverage = (checked / courseLessons(required).length) * 100;
  const graded =
    c.access.mode !== "score" ||
    (grade !== null &&
      grade >= c.access.minScore &&
      coverage >= c.access.minCompletion);
  return {
    allowed: complete && graded,
    requiredId: required.id,
    reason: `Нужно пройти «${required.title}» минимум на ${c.access.minCompletion}% (сейчас ${p.percent}%)${c.access.mode === "score" ? ` и получить средний лучший результат мини-заданий от ${c.access.minScore}/100 (сейчас ${grade === null ? "ещё не измерен" : Math.round(grade)}; проверено ${checked} из ${courseLessons(required).length} заданий)` : ""}.`,
  };
}
export function lessonAccess(
  state: ProgressState,
  id: string,
  c: AppConfig = defaults,
) {
  const location = locateLesson(id);
  if (!location)
    return { allowed: false, reason: "Урок не найден.", requiredId: null };
  const access = courseAccess(state, location.course.id, c);
  if (!access.allowed) return access;
  if (!c.lessons.allowRepeat && state.completedLessons.includes(id))
    return {
      allowed: false,
      reason: "Урок уже пройден. Повтор отключён в локальных настройках.",
      requiredId: null,
    };
  if (c.lessons.sequential) {
    const previous = location.list
      .slice(0, location.index)
      .find((lid) => !state.completedLessons.includes(lid));
    if (previous)
      return {
        allowed: false,
        reason: `Сначала завершите урок ${previous} — в этом браузере включён порядок уроков.`,
        requiredId: previous,
      };
  }
  return { allowed: true, reason: "Урок доступен.", requiredId: null };
}
