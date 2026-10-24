import { courses, locateLesson } from "../data/courses";
import type { AnalyticsEvent } from "./events";
export type PersonalFilter = { days: number; courseId: string; caseId: string };
const dedupe = (events: AnalyticsEvent[]) => [
  ...new Map(events.map((e) => [e.id, e])).values(),
];
export function personalReport(
  raw: AnalyticsEvent[],
  filter: PersonalFilter,
  now = Date.now(),
) {
  const from = filter.days ? now - filter.days * 86400000 : 0;
  const course = courses.find((c) => c.id === filter.courseId);
  const events = dedupe(raw)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .filter(
      (e) =>
        e.mode === "local" &&
        Date.parse(e.timestamp) >= from &&
        Date.parse(e.timestamp) <= now &&
        (!course ||
          e.params.courseId === course.id ||
          (e.params.lessonId &&
            locateLesson(e.params.lessonId)?.course.id === course.id) ||
          (e.params.caseId && course.missions.includes(e.params.caseId))) &&
        (filter.caseId === "all" || e.params.caseId === filter.caseId),
    );
  const completions = [
    ...new Map(
      events
        .filter((e) => e.type === "case_completed")
        .map((e) => [e.params.attemptId || e.id, e]),
    ).values(),
  ];
  const scores = completions.filter((e) => typeof e.params.score === "number");
  const mean = scores.length
    ? scores.reduce((sum, e) => sum + e.params.score!, 0) / scores.length
    : null;
  const checks = events.filter(
    (e) =>
      e.type === "answer_submitted" && typeof e.params.correct === "number",
  );
  const tasks = new Map<string, { id: string; count: number; wrong: number }>();
  for (const e of checks) {
    const id =
      e.params.lessonId ||
      `${e.params.caseId || "mission"}:${e.params.step ?? 0}`;
    const row = tasks.get(id) || { id, count: 0, wrong: 0 };
    row.count++;
    if (e.params.correct === 0) row.wrong++;
    tasks.set(id, row);
  }
  const days = new Map<
    string,
    {
      date: string;
      events: number;
      activeMs: number;
      lessons: number;
      cases: number;
    }
  >();
  const times = new Map<string, number>();
  const intervals = new Map<string, number>();
  for (const e of events) {
    const date = e.timestamp.slice(0, 10),
      row = days.get(date) || {
        date,
        events: 0,
        activeMs: 0,
        lessons: 0,
        cases: 0,
      };
    row.events++;
    if (e.type === "lesson_completed") row.lessons++;
    if (e.type === "case_completed") row.cases++;
    if (
      e.type === "active_learning" &&
      typeof e.params.startMs === "number" &&
      typeof e.params.durationMs === "number"
    ) {
      const end = Math.min(now, e.params.startMs + e.params.durationMs),
        start = Math.max(
          e.params.startMs,
          intervals.get(e.sessionId) || 0,
          from,
          end - 15000,
        );
      const duration = Math.max(0, end - start);
      intervals.set(
        e.sessionId,
        Math.max(intervals.get(e.sessionId) || 0, end),
      );
      let cursor = start;
      while (cursor < end) {
        const day = new Date(cursor).toISOString().slice(0, 10);
        const boundary = (Math.floor(cursor / 86400000) + 1) * 86400000;
        const until = Math.min(end, boundary);
        const target =
          day === date
            ? row
            : days.get(day) || {
                date: day,
                events: 0,
                activeMs: 0,
                lessons: 0,
                cases: 0,
              };
        target.activeMs += until - cursor;
        days.set(day, target);
        cursor = until;
      }
      const label =
        e.params.courseId ||
        (e.params.lessonId
          ? locateLesson(e.params.lessonId)?.course.id
          : undefined) ||
        "cases-local";
      times.set(label, (times.get(label) || 0) + duration);
    }
    days.set(date, row);
  }
  const daily = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  return {
    events,
    sessions: new Set(events.map((e) => e.sessionId)).size,
    activeMs: daily.reduce((sum, d) => sum + d.activeMs, 0),
    lessons: new Set(
      events
        .filter((e) => e.type === "lesson_completed")
        .map((e) => e.params.lessonId),
    ).size,
    cases: new Set(completions.map((e) => e.params.caseId)).size,
    attempts: completions.length,
    mean,
    answers: checks.length,
    errors: checks.filter((e) => e.params.correct === 0).length,
    hints: events.filter((e) => e.type === "hint_used").length,
    retries: events.filter((e) => e.type === "case_retried").length,
    certificates: events.filter((e) => e.type === "certificate_issued").length,
    transitions: events.filter((e) => e.type === "course_transition").length,
    tasks: [...tasks.values()].sort(
      (a, b) => b.wrong / Math.max(1, b.count) - a.wrong / Math.max(1, a.count),
    ),
    daily,
    times: [...times].map(([id, ms]) => ({ id, minutes: ms / 60000 })),
    scores: scores.map((e, i) => ({
      attempt: i + 1,
      date: e.timestamp.slice(0, 10),
      caseId: e.params.caseId,
      score: e.params.score!,
    })),
  };
}
export function heatmapDates(
  daily: { date: string; events: number; activeMs: number }[],
  now = new Date(),
  length = 182,
) {
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const byDate = new Map(daily.map((d) => [d.date, d]));
  return Array.from({ length }, (_, i) => {
    const date = new Date(today - (length - 1 - i) * 86400000)
      .toISOString()
      .slice(0, 10);
    return {
      date,
      events: byDate.get(date)?.events || 0,
      activeMs: byDate.get(date)?.activeMs || 0,
    };
  });
}
export const learningMinutes = (ms: number) =>
  ms < 60000
    ? `${Math.floor(ms / 1000)} сек`
    : `${Math.floor(ms / 3600000)} ч ${Math.floor((ms % 3600000) / 60000)} мин`;
