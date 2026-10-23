import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { createServer, type Server } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { learningReport } from "../src/analytics/learningReport";
const state = vi.hoisted(() => ({ db: null as unknown as PGlite }));
// Run the production adapter's SQL in actual PostgreSQL WASM; only the wire transport is replaced.
vi.mock("pg", () => ({
  default: {
    Pool: class {
      async query(sql: string, values?: unknown[]) {
        const r = await state.db.query(sql, values);
        return { rows: r.rows, rowCount: r.affectedRows || r.rows.length };
      }
      async connect() {
        return { query: this.query.bind(this), release() {} };
      }
    },
  },
}));
import { handleApi } from "./handler";
import { passwordHash } from "./security";
let server: Server, url: string, cookie: string;
const username = "pl_" + randomBytes(12).toString("hex"),
  password = randomBytes(36).toString("base64url");
beforeAll(async () => {
  state.db = new PGlite();
  await state.db.exec(
    await readFile(
      new URL("../database/001_analytics.sql", import.meta.url),
      "utf8",
    ),
  );
  vi.stubEnv("DATABASE_URL", "postgres://test.invalid/database");
  vi.stubEnv("ADMIN_USERNAME", username);
  vi.stubEnv("ADMIN_PASSWORD_HASH", await passwordHash(password));
  vi.stubEnv("ADMIN_SESSION_SECRET", randomBytes(48).toString("hex"));
  server = createServer((req, res) => void handleApi(req, res));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}, 15000);
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await state.db.close();
  vi.unstubAllEnvs();
});
const post = (path: string, data: unknown) =>
  fetch(url + path, {
    method: "POST",
    headers: {
      origin: url,
      "content-type": "application/json",
      "x-productlab-request": "1",
    },
    body: JSON.stringify(data),
  });
const actorId = randomUUID(),
  sessionId = randomUUID();
const event = (type: string, params = {}) => ({
  id: randomUUID(),
  schemaVersion: 1,
  type,
  timestamp: new Date().toISOString(),
  actorId,
  sessionId,
  device: "mobile",
  source: "direct",
  mode: "local",
  params,
});
it("PostgreSQL-миграция повторяема и закрывает доступ PUBLIC", async () => {
  await state.db.exec(
    await readFile(
      new URL("../database/001_analytics.sql", import.meta.url),
      "utf8",
    ),
  );
  const r = await state.db.query<{ relacl: string[] }>(
    "SELECT relacl FROM pg_class WHERE relname=$1",
    ["pl_events"],
  );
  expect(r.rows[0].relacl.every((s) => !s.startsWith("="))).toBe(true);
});
it("HTTP ingest сохраняет события и не дублирует повторную доставку", async () => {
  const events = [
    event("page_view", { route: "/courses" }),
    event("lesson_started", { lessonId: "A1" }),
    event("lesson_completed", { lessonId: "A1" }),
    event("case_completed", {
      caseId: "market",
      attemptId: "test-attempt",
      score: 80,
    }),
  ];
  for (let i = 0; i < 2; i++) {
    const r = await post("/api/events", { consent: true, events });
    expect(r.status).toBe(200);
    expect((await r.json()).accepted).toHaveLength(4);
  }
  const r = await state.db.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM pl_events",
  );
  expect(r.rows[0].count).toBe(4);
  expect((await post("/api/events", { consent: false, events })).status).toBe(
    400,
  );
});
it("закрытый отчёт возвращает реальные сохранённые данные и сессия отзывается", async () => {
  expect((await fetch(url + "/api/admin/analytics")).status).toBe(401);
  const login = await post("/api/admin/login", { username, password });
  expect(login.status).toBe(200);
  cookie = login.headers.get("set-cookie")!;
  const r = await fetch(url + "/api/admin/analytics?days=7", {
    headers: { cookie },
  });
  const result = await r.json();
  expect(result.mode).toBe("server");
  expect(result.events).toHaveLength(4);
  expect(learningReport(result.events)).toMatchObject({
    visitors: 1,
    sessions: 1,
    lessonStarts: 1,
    lessonEnds: 1,
    completion: 1,
    mean: 80,
  });
  expect(
    (
      await fetch(url + "/api/admin/analytics?days=999", {
        headers: { cookie },
      })
    ).status,
  ).toBe(400);
  const logout = await fetch(url + "/api/admin/logout", {
    method: "POST",
    headers: {
      cookie,
      origin: url,
      "content-type": "application/json",
      "x-productlab-request": "1",
    },
    body: "{}",
  });
  expect(logout.status).toBe(200);
  expect(
    (await fetch(url + "/api/admin/analytics", { headers: { cookie } })).status,
  ).toBe(401);
});
it("распределённый лимит хранится в БД и не пропускает шестую попытку", async () => {
  for (let i = 0; i < 4; i++)
    expect(
      (
        await post("/api/admin/login", {
          username,
          password: randomBytes(24).toString("hex"),
        })
      ).status,
    ).toBe(401);
  expect((await post("/api/admin/login", { username, password })).status).toBe(
    429,
  );
  const rows = await state.db.query<{ count: number }>(
    "SELECT count FROM pl_rate_limits WHERE key LIKE $1",
    ["login-ip:%"],
  );
  expect(rows.rows[0].count).toBe(6);
});
