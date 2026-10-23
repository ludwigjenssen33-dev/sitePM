import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { passwordHash, cookieName } from "./security";
import { handleApi, validateBatch } from "./handler";
let server: Server, url: string;
const username = "pl_" + randomBytes(12).toString("hex"),
  password = randomBytes(36).toString("base64url");
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("POSTGRES_URL", "");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ADMIN_USERNAME", username);
  vi.stubEnv("ADMIN_PASSWORD_HASH", await passwordHash(password));
  vi.stubEnv("ADMIN_SESSION_SECRET", randomBytes(48).toString("hex"));
  server = createServer((req, res) => void handleApi(req, res));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  vi.unstubAllEnvs();
});
function post(path: string, data: unknown, cookie?: string, origin = url) {
  return fetch(url + path, {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "x-productlab-request": "1",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(data),
  });
}
it("каждый приватный API требует сессию, поддельный cookie не даёт доступ", async () => {
  for (const path of ["/api/admin/analytics", "/api/admin/anything"]) {
    expect((await fetch(url + path)).status).toBe(401);
    expect(
      (
        await fetch(url + path, {
          headers: { cookie: `${cookieName}=isAdmin` },
        })
      ).status,
    ).toBe(401);
  }
});
it("CSRF и чужой Origin отклоняются до проверки пароля", async () => {
  expect(
    (
      await post(
        "/api/admin/login",
        { username, password },
        undefined,
        "https://other.invalid",
      )
    ).status,
  ).toBe(403);
  expect(
    (await fetch(url + "/api/admin/login", { method: "POST", body: "{}" }))
      .status,
  ).toBe(403);
});
it("вход, закрытая демо-панель и отзыв сессии работают через настоящий HTTP", async () => {
  const response = await post("/api/admin/login", { username, password });
  expect(response.status).toBe(200);
  const cookie = response.headers.get("set-cookie")!;
  expect(cookie).toContain("HttpOnly; Secure; SameSite=Strict");
  const session = await fetch(url + "/api/admin/session", {
    headers: { cookie },
  });
  expect((await session.json()).authenticated).toBe(true);
  const data = await fetch(url + "/api/admin/analytics", {
    headers: { cookie },
  });
  expect(await data.json()).toMatchObject({ mode: "demo", events: [] });
  expect((await post("/api/admin/logout", {}, cookie)).status).toBe(200);
  expect(
    (await fetch(url + "/api/admin/analytics", { headers: { cookie } })).status,
  ).toBe(401);
});
it("неверные пароли ограничены пятью попытками, ошибка не раскрывает аккаунт", async () => {
  let r: Response;
  for (let i = 0; i < 4; i++) {
    r = await post("/api/admin/login", {
      username: randomBytes(10).toString("hex"),
      password: randomBytes(24).toString("hex"),
    });
    expect(r.status).toBe(401);
  }
  r = await post("/api/admin/login", { username, password });
  expect(r.status).toBe(429);
  expect(r.headers.get("retry-after")).toBe("900");
});
it("production без постоянного rate limit не открывает вход", async () => {
  vi.stubEnv("VERCEL", "1");
  expect((await post("/api/admin/login", { username, password })).status).toBe(
    503,
  );
  vi.stubEnv("VERCEL", "");
});
it("без БД события не выдаются за сохранённые", async () => {
  expect(
    (await post("/api/events", { consent: true, events: [] })).status,
  ).toBe(503);
});
const event = () => ({
  id: randomUUID(),
  schemaVersion: 1,
  type: "page_view",
  timestamp: new Date().toISOString(),
  actorId: randomUUID(),
  sessionId: randomUUID(),
  device: "mobile",
  source: "direct",
  mode: "local",
  params: { route: "/courses" },
});
it("сервер принимает только ограниченную схему с согласием", () => {
  expect(validateBatch({ consent: true, events: [event()] })).toHaveLength(1);
  for (const invalid of [
    { consent: false, events: [event()] },
    {
      consent: true,
      events: [
        { ...event(), params: { password: randomBytes(10).toString("hex") } },
      ],
    },
    { consent: true, events: [{ ...event(), timestamp: "2000-01-01" }] },
    { consent: true, events: Array.from({ length: 21 }, event) },
    { consent: true, events: [{ ...event(), actorId: "spoofed" }] },
  ])
    expect(() => validateBatch(invalid)).toThrow("INVALID_EVENTS");
});
