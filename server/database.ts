import pg from "pg";
import type { AnalyticsEvent } from "../src/analytics/events.js";
let pool: pg.Pool | undefined;
export function hasDatabase() {
  return !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}
export function database() {
  if (!hasDatabase()) throw new Error("STORAGE_NOT_CONFIGURED");
  // TLS parameters come from the provider URL. Certificate validation is never disabled.
  pool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    max: 3,
    connectionTimeoutMillis: 6000,
    idleTimeoutMillis: 10000,
  });
  return pool;
}
const localLimits = new Map<string, { count: number; expires: number }>();
const localSessions = new Map<string, number>();
export async function limit(key: string, max: number, seconds: number) {
  const expires = Date.now() + seconds * 1000;
  if (hasDatabase()) {
    const r = await database().query(
      `INSERT INTO pl_rate_limits(key,count,expires_at) VALUES($1,1,$2)
      ON CONFLICT(key) DO UPDATE SET count=CASE WHEN pl_rate_limits.expires_at<now() THEN 1 ELSE pl_rate_limits.count+1 END,
      expires_at=CASE WHEN pl_rate_limits.expires_at<now() THEN EXCLUDED.expires_at ELSE pl_rate_limits.expires_at END RETURNING count`,
      [key, new Date(expires)],
    );
    return Number(r.rows[0].count) <= max;
  }
  // Only local development: production authentication requires durable rate limiting.
  if (process.env.VERCEL || process.env.NODE_ENV === "production")
    throw new Error("STORAGE_NOT_CONFIGURED");
  for (const [k, v] of localLimits)
    if (v.expires < Date.now()) localLimits.delete(k);
  if (localLimits.size > 10000) localLimits.clear();
  const old = localLimits.get(key);
  const next =
    old && old.expires > Date.now()
      ? { ...old, count: old.count + 1 }
      : { count: 1, expires };
  localLimits.set(key, next);
  return next.count <= max;
}
export async function createSession(hash: string, expires: Date) {
  if (hasDatabase())
    await database().query(
      "INSERT INTO pl_admin_sessions(token_hash,expires_at) VALUES($1,$2)",
      [hash, expires],
    );
  else localSessions.set(hash, expires.getTime());
}
export async function validSession(hash: string) {
  if (hasDatabase())
    return (
      (
        await database().query(
          "SELECT 1 FROM pl_admin_sessions WHERE token_hash=$1 AND expires_at>now()",
          [hash],
        )
      ).rowCount === 1
    );
  return (
    !process.env.VERCEL &&
    process.env.NODE_ENV !== "production" &&
    (localSessions.get(hash) || 0) > Date.now()
  );
}
export async function revokeSession(hash: string) {
  if (hasDatabase())
    await database().query(
      "DELETE FROM pl_admin_sessions WHERE token_hash=$1",
      [hash],
    );
  else localSessions.delete(hash);
}
export async function saveEvents(events: AnalyticsEvent[]) {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    for (const e of events)
      await client.query(
        `INSERT INTO pl_events(id,occurred_at,actor_id,session_id,event_type,device,source,params) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING`,
        [
          e.id,
          e.timestamp,
          e.actorId,
          e.sessionId,
          e.type,
          e.device,
          e.source,
          JSON.stringify(e.params),
        ],
      );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function readEvents(days: number) {
  const r = await database().query(
    `SELECT id,occurred_at,actor_id,session_id,event_type,device,source,params FROM pl_events WHERE occurred_at>=now()-($1::int*interval '1 day') ORDER BY occurred_at DESC LIMIT 20001`,
    [days],
  );
  return {
    truncated: r.rows.length > 20000,
    events: r.rows
      .slice(0, 20000)
      .map(
        (row) =>
          ({
            id: row.id,
            schemaVersion: 1,
            type: row.event_type,
            timestamp: new Date(row.occurred_at).toISOString(),
            actorId: row.actor_id,
            sessionId: row.session_id,
            device: row.device,
            source: row.source,
            params: row.params,
            mode: "server",
          }) as AnalyticsEvent,
      )
      .reverse(),
  };
}
