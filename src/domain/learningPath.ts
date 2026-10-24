import { cases } from "../data/cases";
import { bestAttempts, type ProgressState } from "./progress";
/** Сколько завершённых миссий нужно, чтобы открылась итоговая. */
export const FINAL_UNLOCK = 3;
export function missionAccess(
  state: ProgressState,
  id: string,
  isAdmin = false,
) {
  const index = cases.findIndex((c) => c.id === id);
  if (index < 0)
    return { allowed: false, reason: "Миссия не найдена", previous: null };
  const previous = index > 0 ? cases[index - 1] : null;
  // Обычные миссии открыты в любом порядке (ТЗ, п. 14); итоговая — после FINAL_UNLOCK завершённых.
  const existing = state.attempts.some(
    (a) => a.caseId === id && !a.summaryOnly,
  );
  const completed = new Set(
    bestAttempts(state)
      .map((a) => a.caseId)
      .filter((cid) => cid !== id),
  );
  const allowed =
    isAdmin ||
    existing ||
    !cases[index].isFinal ||
    completed.size >= FINAL_UNLOCK;
  return {
    allowed,
    reason: allowed
      ? ""
      : `Итоговая миссия откроется после ${FINAL_UNLOCK} любых завершённых миссий. Сейчас завершено: ${completed.size}.`,
    previous,
  };
}
export function nextMission(state: ProgressState) {
  const done = new Set(bestAttempts(state).map((a) => a.caseId));
  const unfinished = state.attempts
    .filter((a) => !a.finished && state.active[a.caseId] === a.id)
    .sort((a, b) => b.updated.localeCompare(a.updated));
  const resume = unfinished.find((a) => missionAccess(state, a.caseId).allowed);
  return resume
    ? cases.find((c) => c.id === resume.caseId)!
    : cases.find((c) => !done.has(c.id)) || null;
}
const day = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Yekaterinburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
export function learningActivity(state: ProgressState, now = new Date()) {
  const dates = [
    ...new Set(
      [
        ...state.attempts
          .filter((a) => a.finished && !a.summaryOnly)
          .map((a) => a.updated),
        ...(state.learningDays || []),
      ].map((iso) => day(iso)),
    ),
  ]
    .sort()
    .reverse();
  const today = day(now.toISOString());
  const yesterday = day(new Date(now.getTime() - 86400000).toISOString());
  let streak = 0;
  if (dates[0] === today || dates[0] === yesterday) {
    let cursor = Date.parse(dates[0] + "T00:00:00Z");
    for (const date of dates) {
      if (Date.parse(date + "T00:00:00Z") !== cursor) break;
      streak++;
      cursor -= 86400000;
    }
  }
  return {
    streak,
    days: dates.length,
    todayCompleted: dates.includes(today),
    next: nextMission(state),
  };
}
