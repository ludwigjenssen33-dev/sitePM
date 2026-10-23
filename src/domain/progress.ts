import { emptyAnswers, type Answers } from '../lib/scoring';

export type Criterion = { name: string; points: number; max: number };
export type Attempt = {
  id: string; caseId: string; variant: number; step: number; answers: Answers;
  confirmed: boolean; finished: boolean; score: number; best?: number;
  updated: string; startedAt: string; stageTimes?: number[]; criteria?: Criterion[];
  /** Historical scores are preserved as recorded; v1 had a different decision rubric. */
  migrated?: boolean; summaryOnly?: boolean;
};
export type Certificate = {
  id: string; number: string; alias: string; guestId: string; issuedAt: string;
  average: number; level: number; program: string; local: true; requiredCaseIds: string[];
};
export type ProgressState = {
  version: 2; attempts: Attempt[]; active: Record<string, string>;
  profile: { alias: string; publicRanking: boolean; guestId: string };
  certificates: Certificate[]; completedLessons: string[];
};
export const criterionNames = ['Диагностика метрик', 'Формулировка гипотез', 'Выбор метрик эксперимента', 'Интерпретация A/B-тестов', 'Принятие решений'];
export const criterionMaxima = [25, 20, 15, 20, 20];

export function uniqueId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${uuid}`;
}
export function emptyProgress(): ProgressState {
  return { version: 2, attempts: [], active: {}, profile: { alias: 'Исследователь', publicRanking: false, guestId: uniqueId('guest') }, certificates: [], completedLessons: [] };
}
export function newAttempt(caseId: string, variant = 0): Attempt {
  const now = new Date().toISOString();
  return { id: uniqueId('attempt'), caseId, variant, step: 0, answers: { ...emptyAnswers, reasons: [], hints: [] }, confirmed: false, finished: false, score: 0, updated: now, startedAt: now, stageTimes: [0, 0, 0, 0] };
}
export function startAttempt(state: ProgressState, caseId: string, variant = 0): ProgressState {
  const attempt = newAttempt(caseId, variant);
  return { ...state, attempts: [...state.attempts, attempt], active: { ...state.active, [caseId]: attempt.id } };
}
export function updateAttempt(state: ProgressState, attempt: Attempt): ProgressState {
  const existing = state.attempts.find(a => a.id === attempt.id);
  // A stale screen must not overwrite a newer attempt or erase a completed result.
  if (existing && (Date.parse(existing.updated) > Date.parse(attempt.updated) || (existing.finished && !attempt.finished))) return state;
  return { ...state, attempts: existing ? state.attempts.map(a => a.id === attempt.id ? attempt : a) : [...state.attempts, attempt], active: { ...state.active, [attempt.caseId]: attempt.id } };
}
export function bestAttempts(state: Pick<ProgressState, 'attempts'>): Attempt[] {
  const best = new Map<string, Attempt>();
  for (const attempt of state.attempts.filter(a => a.finished)) {
    const old = best.get(attempt.caseId);
    if (!old || attempt.score > old.score || (attempt.score === old.score && attempt.updated > old.updated)) best.set(attempt.caseId, attempt);
  }
  return [...best.values()];
}
export function skills(state: ProgressState) {
  const best = bestAttempts(state);
  const recommendations = [
    'Повторите A2–A3: разложите KPI и найдите изменившийся компонент.',
    'Повторите B2–B3: сильный диагноз и проверяемая гипотеза с механизмом.',
    'Повторите B4: определите основную и контрольную метрики до теста.',
    'Повторите C2–C3: значимость, интервал, выборка и качество теста.',
    'Повторите C5: учитывайте план, контрольные метрики и бизнес-ограничения.'
  ];
  return criterionNames.map((name, i) => {
    const available = best.filter(a => a.criteria?.[i] && a.criteria[i].max > 0);
    const percent = available.length ? Math.round(available.reduce((sum, a) => sum + a.criteria![i].points / a.criteria![i].max, 0) / available.length * 100) : 0;
    return { id: ['diagnosis', 'hypothesis', 'metrics', 'interpretation', 'decision'][i], name, percent, recommendation: percent >= 80 ? 'Сильный навык. Закрепите его в новой миссии с другими данными.' : recommendations[i], cases: available.length };
  });
}
/** XP = 10 × сумма лучших итоговых баллов уникальных кейсов. Повтор не добавляет XP без улучшения. */
export function xp(state: Pick<ProgressState, 'attempts'>) { return bestAttempts(state).reduce((sum, a) => sum + Math.round(Math.max(0, Math.min(100, a.score))) * 10, 0); }
export function level(state: Pick<ProgressState, 'attempts'>) {
  const total = xp(state), number = Math.floor(total / 1000) + 1;
  return { number, label: number >= 8 ? 'Продуктовый стратег' : number >= 5 ? 'Исследователь решений' : number >= 3 ? 'Практик экспериментов' : 'Начинающий исследователь', currentXP: total, nextXP: number * 1000, progress: total % 1000 / 10 };
}
export function achievements(state: ProgressState) {
  const finished = state.attempts.filter(a => a.finished), best = bestAttempts(state);
  const hasImproved = finished.some(a => finished.some(b => a.caseId === b.caseId && b.updated < a.updated && a.score > b.score));
  const chronological = [...finished].sort((a, b) => a.updated.localeCompare(b.updated));
  let streak = 0, bestStreak = 0; const seen = new Set<string>();
  for (const attempt of chronological) {
    // Replays of a single mission do not create a success streak.
    if (seen.has(attempt.caseId)) continue;
    seen.add(attempt.caseId); streak = attempt.score >= 70 ? streak + 1 : 0; bestStreak = Math.max(streak, bestStreak);
  }
  return [
    { id: 'first', title: 'Первое решение', description: 'Завершите первую миссию.', earned: best.length > 0 },
    { id: 'independent', title: 'Без страховки', description: 'Завершите миссию на 70+ баллов без подсказок.', earned: finished.some(a => !a.migrated && a.score >= 70 && !(a.answers.hints?.length)) },
    { id: 'improved', title: 'Новая высота', description: 'Улучшите результат предыдущей попытки.', earned: hasImproved },
    { id: 'streak', title: 'Три точных решения', description: 'Пройдите три разные миссии подряд на 70+ баллов.', earned: bestStreak >= 3 },
    { id: 'master', title: 'Аналитический максимум', description: 'Получите 100 баллов в любой миссии.', earned: best.some(a => a.score === 100) },
    { id: 'reader', title: 'Теория в деле', description: 'Завершите все 14 уроков.', earned: new Set(state.completedLessons).size >= 14 }
  ];
}
export function certificateEligibility(state: ProgressState, requiredCaseIds: string[], finalId: string) {
  const required = [...new Set([...requiredCaseIds, finalId])], best = bestAttempts(state);
  const selected = best.filter(a => required.includes(a.caseId));
  const missing = required.filter(id => !selected.some(a => a.caseId === id));
  const rawAverage = selected.length ? selected.reduce((sum, a) => sum + a.score, 0) / selected.length : 0;
  const average = Math.round(rawAverage * 10) / 10;
  const reasons = [...(missing.length ? [`Осталось обязательных миссий: ${missing.length}.`] : []), ...(rawAverage < 70 ? ['Средний лучший результат должен быть не ниже 70/100.'] : [])];
  return { eligible: required.length > 0 && missing.length === 0 && rawAverage >= 70, average, completed: selected.length, required: required.length, missing, reasons };
}
export function issueLocalCertificate(state: ProgressState, requiredCaseIds: string[], finalId: string): ProgressState {
  const eligibility = certificateEligibility(state, requiredCaseIds, finalId);
  const required = [...new Set([...requiredCaseIds, finalId])].sort();
  if (!eligibility.eligible || state.certificates.some(c => c.requiredCaseIds.join('|') === required.join('|'))) return state;
  const id = uniqueId('certificate');
  const certificate: Certificate = { id, number: `PL-${new Date().getUTCFullYear()}-${id.slice(-8).toUpperCase()}`, alias: state.profile.alias, guestId: state.profile.guestId, issuedAt: new Date().toISOString(), average: eligibility.average, level: level(state).number, program: 'Продуктовая аналитика: от диагностики до решения', local: true, requiredCaseIds: required };
  return { ...state, certificates: [...state.certificates, certificate] };
}
export type LearnerRecord = { id: string; alias: string; publicRanking?: boolean; attempts: Attempt[] };
export type RankedLearner = { id: string; alias: string; rank: number; points: number; completed: number; average: number; noHints: number; achievements: number; level: number };
/** За неделю = последние 7 суток. Порядок: баллы, число миссий, без подсказок, стабильный ID. */
export function rankLearners(records: LearnerRecord[], period: 'all' | 'week' = 'all', now = new Date()): RankedLearner[] {
  const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  return records.filter(r => r.publicRanking === true).map(record => {
    const attempts = record.attempts.filter(a => a.finished && (period === 'all' || (Date.parse(a.updated) >= cutoff && Date.parse(a.updated) <= now.getTime())));
    const best = bestAttempts({ attempts });
    const points = best.reduce((sum, a) => sum + a.score, 0);
    const mockState: ProgressState = { ...emptyProgress(), attempts };
    return { id: record.id, alias: record.alias, rank: 0, points, completed: best.length, average: best.length ? Math.round(points / best.length * 10) / 10 : 0, noHints: best.filter(a => !a.migrated && !a.answers.hints?.length).length, achievements: achievements(mockState).filter(a => a.earned).length, level: level(mockState).number };
  }).sort((a, b) => b.points - a.points || b.completed - a.completed || b.noHints - a.noHints || a.id.localeCompare(b.id)).map((row, i) => ({ ...row, rank: i + 1 }));
}
