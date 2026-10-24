export const IDLE_MS = 30 * 60 * 1000;
export const MAX_SESSION_MS = 8 * 60 * 60 * 1000;
export const MAX_SLICE_MS = 15000;
export type SessionClock = {
  id: string;
  started: number;
  last: number;
  ended?: boolean;
};
export function sessionExpired(session: SessionClock, now: number) {
  return (
    session.ended ||
    !Number.isFinite(session.started) ||
    !Number.isFinite(session.last) ||
    now < session.started ||
    now - session.started >= MAX_SESSION_MS ||
    now - session.last >= IDLE_MS
  );
}
/** Monotone watermark prevents replaying a slice after refresh or from another tab. */
export function activeSlice(
  from: number,
  to: number,
  lastCounted: number,
  session: SessionClock,
  visible: boolean,
) {
  if (!visible || !Number.isFinite(from) || !Number.isFinite(to) || to <= from)
    return null;
  const start = Math.max(from, lastCounted, session.started, to - MAX_SLICE_MS);
  const end = Math.min(
    to,
    session.started + MAX_SESSION_MS,
    session.last + IDLE_MS,
  );
  return end > start ? { start, end, duration: end - start } : null;
}
