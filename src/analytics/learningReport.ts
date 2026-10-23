import type { AnalyticsEvent } from "./events";
const distinct = (
  events: AnalyticsEvent[],
  key: (e: AnalyticsEvent) => string,
) => [...new Map(events.map((e) => [key(e), e])).values()];
export function learningReport(events: AnalyticsEvent[]) {
  const all = distinct(events, (e) => e.id);
  const filter = (t: AnalyticsEvent["type"]) => all.filter((e) => e.type === t);
  const starts = distinct(
    filter("lesson_started"),
    (e) => e.actorId + ":" + e.params.lessonId,
  );
  const ends = distinct(
    filter("lesson_completed"),
    (e) => e.actorId + ":" + e.params.lessonId,
  );
  const completions = distinct(
    filter("case_completed").filter((e) => typeof e.params.score === "number"),
    (e) => e.actorId + ":" + (e.params.attemptId || e.params.caseId),
  );
  const scores = completions.map((e) => e.params.score!);
  const mean = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;
  const tasks = new Map<
    string,
    { id: string; answers: number; errors: number; hints: number }
  >();
  for (const e of all) {
    const id =
      e.params.lessonId ||
      [e.params.caseId, e.params.step ?? 0]
        .filter((v) => v !== undefined)
        .join(":");
    if (!id) continue;
    const row = tasks.get(id) || { id, answers: 0, errors: 0, hints: 0 };
    if (e.type === "answer_submitted") row.answers++;
    if (e.type === "exercise_error") row.errors++;
    if (e.type === "hint_used") row.hints++;
    tasks.set(id, row);
  }
  const courseMap = new Map<string, Set<string>>();
  for (const e of filter("course_viewed")) {
    const id = e.params.courseId || "unknown";
    const set = courseMap.get(id) || new Set<string>();
    set.add(e.actorId);
    courseMap.set(id, set);
  }
  const caseMap = new Map<string, number[]>();
  for (const e of completions) {
    const id = e.params.caseId || "unknown";
    caseMap.set(id, [...(caseMap.get(id) || []), e.params.score!]);
  }
  const dates = new Map<
    string,
    { date: string; visitors: Set<string>; lessons: number; cases: number }
  >();
  for (const e of all) {
    const date = e.timestamp.slice(0, 10);
    const row = dates.get(date) || {
      date,
      visitors: new Set<string>(),
      lessons: 0,
      cases: 0,
    };
    row.visitors.add(e.actorId);
    if (ends.includes(e)) row.lessons++;
    if (completions.includes(e)) row.cases++;
    dates.set(date, row);
  }
  return {
    visitors: new Set(all.map((e) => e.actorId)).size,
    sessions: new Set(all.map((e) => e.sessionId)).size,
    views: filter("page_view").length,
    courseViews: filter("course_viewed").length,
    lessonStarts: starts.length,
    lessonEnds: ends.length,
    completion: starts.length
      ? ends.filter((e) =>
          starts.some(
            (s) =>
              s.actorId === e.actorId &&
              s.params.lessonId === e.params.lessonId,
          ),
        ).length / starts.length
      : null,
    mean,
    caseEnds: completions.length,
    errors: filter("exercise_error").length,
    hints: filter("hint_used").length,
    certificates: new Set(filter("certificate_issued").map((e) => e.actorId))
      .size,
    tasks: [...tasks.values()]
      .filter((r) => r.answers || r.errors || r.hints)
      .sort((a, b) => b.errors - a.errors),
    courses: [...courseMap].map(([id, set]) => ({ id, visitors: set.size })),
    caseResults: [...caseMap].map(([id, v]) => ({
      id,
      count: v.length,
      average: v.reduce((a, b) => a + b, 0) / v.length,
    })),
    distribution: Array.from({ length: 5 }, (_, i) => ({
      band: `${20 * i}–${i === 4 ? 100 : 20 * i + 19}`,
      count: scores.filter((n) => Math.min(4, Math.floor(n / 20)) === i).length,
    })),
    daily: [...dates.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({
        date: r.date,
        visitors: r.visitors.size,
        lessons: r.lessons,
        cases: r.cases,
      })),
  };
}
