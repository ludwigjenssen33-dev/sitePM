import { emptyAnswers, type Answers } from '../lib/scoring';
import { emptyProgress, criterionNames, criterionMaxima, type Attempt, type Certificate, type ProgressState } from '../domain/progress';

export const progressKey = 'product-lab-v2';
export const legacyProgressKey = 'product-lab-v1';
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const safeId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9-]{0,159}$/.test(value);
const validTime = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const validScore = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
function parseAnswers(value: unknown): Answers | null {
  if (!isRecord(value) || typeof value.node !== 'string' || value.node.length > 160 || typeof value.note !== 'string' || value.note.length > 10000) return null;
  for (const field of ['hypothesis', 'primary', 'guardrail', 'interpretation', 'decision']) {
    if (!Number.isInteger(value[field]) || (value[field] as number) < -1 || (value[field] as number) > 30) return null;
  }
  for (const field of ['reasons', 'hints']) {
    if (value[field] !== undefined && (!Array.isArray(value[field]) || !(value[field] as unknown[]).every(v => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= (field === 'hints' ? 3 : 5)))) return null;
  }
  return { node: value.node, note: value.note, hypothesis: value.hypothesis as number, primary: value.primary as number, guardrail: value.guardrail as number, interpretation: value.interpretation as number, decision: value.decision as number, reasons: [...new Set((value.reasons as number[] | undefined) ?? [])], hints: [...new Set((value.hints as number[] | undefined) ?? [])] };
}
function parseAttempt(value: unknown): Attempt | null {
  if (!isRecord(value) || !safeId(value.id) || !safeId(value.caseId) || !Number.isInteger(value.variant) || (value.variant as number) < 0 || (value.variant as number) > 1000 || !Number.isInteger(value.step) || (value.step as number) < 0 || (value.step as number) > 3 || typeof value.confirmed !== 'boolean' || typeof value.finished !== 'boolean' || !validScore(value.score) || !validTime(value.updated) || !validTime(value.startedAt)) return null;
  const answers = parseAnswers(value.answers); if (!answers) return null;
  if (value.best !== undefined && !validScore(value.best)) return null;
  let criteria: Attempt['criteria'];
  if (value.criteria !== undefined) {
    if (!Array.isArray(value.criteria) || value.criteria.length !== 5 || !value.criteria.every((row, i) => isRecord(row) && typeof row.name === 'string' && typeof row.points === 'number' && Number.isFinite(row.points) && row.points >= 0 && row.points <= criterionMaxima[i] && row.max === criterionMaxima[i])) return null;
    criteria = value.criteria.map(row => ({ name: row.name, points: row.points, max: row.max }));
  }
  const stageTimes = Array.isArray(value.stageTimes) && value.stageTimes.length === 4 && value.stageTimes.every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0) ? [...value.stageTimes] as number[] : undefined;
  return { id: value.id, caseId: value.caseId, variant: value.variant as number, step: value.step as number, answers, confirmed: value.confirmed, finished: value.finished, score: value.score, ...(validScore(value.best) ? { best: value.best } : {}), updated: value.updated, startedAt: value.startedAt, ...(criteria ? { criteria } : {}), ...(stageTimes ? { stageTimes } : {}), ...(value.migrated === true ? { migrated: true } : {}), ...(value.summaryOnly === true ? { summaryOnly: true } : {}) };
}
function parseCertificate(value: unknown): Certificate | null {
  if (!isRecord(value) || !safeId(value.id) || typeof value.number !== 'string' || typeof value.alias !== 'string' || value.alias.length > 80 || !safeId(value.guestId) || !validTime(value.issuedAt) || !validScore(value.average) || !Number.isInteger(value.level) || (value.level as number) < 1 || typeof value.program !== 'string' || value.local !== true || !Array.isArray(value.requiredCaseIds) || !value.requiredCaseIds.every(safeId)) return null;
  return { id: value.id, number: value.number.slice(0, 100), alias: value.alias, guestId: value.guestId, issuedAt: value.issuedAt, average: value.average, level: value.level as number, program: value.program.slice(0, 300), local: true, requiredCaseIds: [...new Set(value.requiredCaseIds as string[])].sort() };
}
export function parseProgress(value: unknown): ProgressState | null {
  if (!isRecord(value) || value.version !== 2 || !Array.isArray(value.attempts) || !isRecord(value.profile) || !safeId(value.profile.guestId) || typeof value.profile.alias !== 'string' || value.profile.alias.length > 80 || typeof value.profile.publicRanking !== 'boolean') return null;
  const attempts = value.attempts.map(parseAttempt).filter((a): a is Attempt => a !== null);
  const active: Record<string, string> = {};
  if (isRecord(value.active)) for (const [id, attemptId] of Object.entries(value.active)) {
    if (safeId(id) && typeof attemptId === 'string' && attempts.some(a => a.id === attemptId && a.caseId === id)) active[id] = attemptId;
  }
  const certificates = Array.isArray(value.certificates) ? value.certificates.map(parseCertificate).filter((c): c is Certificate => c !== null) : [];
  const completedLessons = Array.isArray(value.completedLessons) ? [...new Set(value.completedLessons.filter((id): id is string => typeof id === 'string' && /^[ABC][1-9][0-9]?$/.test(id)))] : [];
  return { version: 2, attempts, active, profile: { guestId: value.profile.guestId, alias: value.profile.alias, publicRanking: value.profile.publicRanking }, certificates, completedLessons };
}
/** Preserve exact old rubric instead of retroactively charging reasons/hints absent in v1. */
function legacyCriteria(caseId: string, answers: Answers) {
  const diagnosis = ({ market: 'conversion', stream: 'cancel', food: 'cost' } as Record<string, string>)[caseId];
  const decision = ({ market: 2, stream: 0, food: 1 } as Record<string, number>)[caseId];
  const points = [answers.node === diagnosis ? 25 : caseId === 'food' && answers.node === 'margin' ? 15 : 0, answers.hypothesis === 1 ? 20 : 0, (answers.primary === 0 ? 10 : 0) + (answers.guardrail === 0 ? 5 : 0), answers.interpretation === 0 ? 20 : 0, answers.decision === decision ? 20 : 0];
  return criterionNames.map((name, i) => ({ name, points: points[i], max: criterionMaxima[i] }));
}
export function migrateLegacy(value: unknown, initial: ProgressState = emptyProgress()): ProgressState {
  if (!isRecord(value)) return initial;
  let state = initial;
  for (const [caseId, raw] of Object.entries(value)) {
    if (!safeId(caseId) || !isRecord(raw) || !validScore(raw.score) || !validScore(raw.best) || !validTime(raw.updated) || !Number.isInteger(raw.step) || (raw.step as number) < 0 || (raw.step as number) > 3 || typeof raw.confirmed !== 'boolean' || typeof raw.finished !== 'boolean') continue;
    const answers = parseAnswers(raw.answers); if (!answers) continue;
    const id = `legacy-${caseId}`;
    const recorded: Attempt = { id, caseId, variant: 0, step: raw.step as number, answers, confirmed: raw.confirmed, finished: raw.finished, score: raw.score, best: raw.best, updated: raw.updated, startedAt: raw.updated, migrated: true, ...(raw.finished && ['market', 'stream', 'food'].includes(caseId) ? { criteria: legacyCriteria(caseId, answers) } : {}) };
    const additions = [recorded];
    if (raw.best > (raw.finished ? raw.score : 0)) additions.push({ ...recorded, id: `${id}-best`, step: 3, finished: true, confirmed: true, score: raw.best, answers: { ...emptyAnswers, reasons: [], hints: [] }, criteria: undefined, summaryOnly: true });
    const migrated: ProgressState = { ...state, attempts: additions, active: { [caseId]: id } };
    state = mergeProgress(state, migrated);
  }
  return state;
}
/** Union history, prefer more recent snapshots, never replace a completed attempt with a draft. Local identity stays local. */
export function mergeProgress(local: ProgressState, incoming: ProgressState): ProgressState {
  const attempts = new Map(local.attempts.map(a => [a.id, a]));
  for (const a of incoming.attempts) {
    const existing = attempts.get(a.id);
    if (!existing || ((!existing.finished || a.finished) && Date.parse(a.updated) > Date.parse(existing.updated))) attempts.set(a.id, a);
  }
  const active = { ...local.active };
  for (const [caseId, attemptId] of Object.entries(incoming.active)) {
    const old = attempts.get(active[caseId]), candidate = attempts.get(attemptId);
    if (candidate && (!old || Date.parse(candidate.startedAt) > Date.parse(old.startedAt))) active[caseId] = attemptId;
  }
  const certificates = new Map(local.certificates.map(c => [c.id, c]));
  for (const c of incoming.certificates) if (!certificates.has(c.id)) certificates.set(c.id, c);
  return { ...local, attempts: [...attempts.values()], active, certificates: [...certificates.values()], completedLessons: [...new Set([...local.completedLessons, ...incoming.completedLessons])] };
}
function readJSON(key: string): unknown { const raw = localStorage.getItem(key); return raw === null ? null : JSON.parse(raw); }
export function loadProgress(): ProgressState {
  const initial = emptyProgress();
  try {
    let current: ProgressState | null = null;
    try { current = parseProgress(readJSON(progressKey)); } catch { /* Preserve malformed source on disk; saving creates a recovery copy. */ }
    let legacy: unknown = null; try { legacy = readJSON(legacyProgressKey); } catch { /* No fabricated migration of an unreadable record. */ }
    return migrateLegacy(legacy, current ?? initial);
  } catch { return initial; }
}
export function saveProgress(state: ProgressState): boolean {
  try {
    const sanitized = parseProgress(state); if (!sanitized) return false;
    const raw = localStorage.getItem(progressKey);
    let stored: ProgressState | null = null;
    if (raw !== null) {
      let parsedRaw: unknown;
      try { parsedRaw = JSON.parse(raw); stored = parseProgress(parsedRaw); } catch { /* backup below */ }
      const lostRecords = stored && isRecord(parsedRaw) && Array.isArray(parsedRaw.attempts) && stored.attempts.length !== parsedRaw.attempts.length;
      if (!stored || lostRecords) {
        const backup = `${progressKey}-recovery-${Date.now()}`;
        localStorage.setItem(backup, raw);
      }
    }
    // On equal timestamps the caller's current fields win; on newer disk data merge keeps the newer result.
    const merged = stored ? mergeProgress(sanitized, stored) : sanitized;
    localStorage.setItem(progressKey, JSON.stringify(merged));
    return true;
  } catch { return false; }
}
