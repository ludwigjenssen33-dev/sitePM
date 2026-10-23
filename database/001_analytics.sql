-- PostgreSQL 14+. Execute as the database owner, never from the browser.
BEGIN;
CREATE TABLE IF NOT EXISTS pl_events (
 id uuid PRIMARY KEY, occurred_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
 actor_id uuid NOT NULL, session_id uuid NOT NULL, event_type text NOT NULL,
 device text NOT NULL CHECK(device IN ('mobile','desktop','unknown')),
 source text NOT NULL CHECK(source IN ('direct','search','social','referral','unknown')),
 params jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(params)='object')
);
CREATE INDEX IF NOT EXISTS pl_events_date ON pl_events(occurred_at);
CREATE INDEX IF NOT EXISTS pl_events_actor ON pl_events(actor_id,occurred_at);
CREATE INDEX IF NOT EXISTS pl_events_session ON pl_events(session_id,occurred_at);
CREATE INDEX IF NOT EXISTS pl_events_type ON pl_events(event_type,occurred_at);
CREATE TABLE IF NOT EXISTS pl_admin_sessions(token_hash text PRIMARY KEY,expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS pl_admin_sessions_expiry ON pl_admin_sessions(expires_at);
CREATE TABLE IF NOT EXISTS pl_rate_limits(key text PRIMARY KEY,count integer NOT NULL,expires_at timestamptz NOT NULL);
-- No anonymous browser credentials or public SQL access. Use a restricted server DB role.
REVOKE ALL ON pl_events,pl_admin_sessions,pl_rate_limits FROM PUBLIC;
COMMIT;
-- Daily maintenance (owner scheduler, or manually). Raw events: 90 days retention.
-- DELETE FROM pl_events WHERE occurred_at < now()-interval '90 days';
-- DELETE FROM pl_admin_sessions WHERE expires_at < now();
-- DELETE FROM pl_rate_limits WHERE expires_at < now();
