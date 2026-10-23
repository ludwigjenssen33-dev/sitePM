import type { IncomingMessage, ServerResponse } from "node:http";
import {
  isAnalyticsEvent,
  type AnalyticsEvent,
} from "../src/analytics/events.js";
import {
  configured,
  cookieName,
  fingerprint,
  newToken,
  readToken,
  sameText,
  sessionCookie,
  sessionSeconds,
  tokenHash,
  verifyPassword,
} from "./security.js";
import {
  createSession,
  hasDatabase,
  limit,
  readEvents,
  revokeSession,
  saveEvents,
  validSession,
} from "./database.js";

type Request = IncomingMessage & { body?: unknown };
function reply(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}
function sameOrigin(req: Request) {
  try {
    const host = req.headers.host;
    if (!host) return false;
    const expected =
      process.env.APP_ORIGIN ||
      `${/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https"}://${host}`;
    return (
      new URL(req.headers.origin || "").origin === new URL(expected).origin &&
      req.headers["x-productlab-request"] === "1" &&
      req.headers["content-type"]?.startsWith("application/json")
    );
  } catch {
    return false;
  }
}
async function body(req: Request) {
  if (req.body !== undefined) {
    const data =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(data) > 48000) throw new Error("BODY_TOO_LARGE");
    return JSON.parse(data);
  }
  let raw = "";
  for await (const chunk of req) {
    raw += chunk.toString();
    if (Buffer.byteLength(raw) > 48000) throw new Error("BODY_TOO_LARGE");
  }
  return JSON.parse(raw || "{}");
}
export function validateBatch(
  value: unknown,
  now = Date.now(),
): AnalyticsEvent[] {
  if (!value || typeof value !== "object") throw new Error("INVALID_EVENTS");
  const b = value as { consent?: boolean; events?: unknown[] };
  if (
    b.consent !== true ||
    !Array.isArray(b.events) ||
    b.events.length < 1 ||
    b.events.length > 20
  )
    throw new Error("INVALID_EVENTS");
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return b.events.map((e) => {
    if (
      !isAnalyticsEvent(e) ||
      e.mode !== "local" ||
      !uuid.test(e.id) ||
      !uuid.test(e.actorId) ||
      !uuid.test(e.sessionId) ||
      Date.parse(e.timestamp) > now + 300000 ||
      Date.parse(e.timestamp) < now - 7 * 86400000
    )
      throw new Error("INVALID_EVENTS");
    return e;
  });
}
export async function handleApi(req: Request, res: ServerResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Vary", "Cookie");
  const path = new URL(
    req.url || "/",
    `http://${req.headers.host || "localhost"}`,
  ).pathname;
  try {
    if (!["GET", "POST"].includes(req.method || ""))
      return reply(res, 405, { error: "Метод не поддерживается." });
    if (req.method === "POST" && !sameOrigin(req))
      return reply(res, 403, {
        error: "Запрос отклонён: недопустимый источник.",
      });
    const ip = String(
      req.headers["x-vercel-forwarded-for"] ||
        req.socket.remoteAddress ||
        "unknown",
    )
      .split(",")[0]
      .trim();
    if (path === "/api/events" && req.method === "POST") {
      if (!hasDatabase())
        return reply(res, 503, {
          code: "STORAGE_NOT_CONFIGURED",
          error:
            "Общее хранилище ещё не подключено. События остаются в браузере.",
        });
      if (!configured())
        return reply(res, 503, { error: "Сервер ещё не настроен." });
      if (!(await limit("events:" + fingerprint(ip), 240, 60)))
        return reply(res, 429, {
          error: "Слишком много событий. Повторите позже.",
        });
      const events = validateBatch(await body(req));
      await saveEvents(events);
      return reply(res, 200, { accepted: events.map((e) => e.id) });
    }
    if (path === "/api/admin/login" && req.method === "POST") {
      if (
        !configured() ||
        ((process.env.VERCEL || process.env.NODE_ENV === "production") &&
          !hasDatabase())
      )
        return reply(res, 503, {
          code: "SETUP_REQUIRED",
          error:
            "Вход закрыт до настройки серверных секретов и постоянного хранилища.",
        });
      // Both limits are reserved before reading credentials, including successful requests.
      if (
        !(await limit("login-ip:" + fingerprint(ip), 5, 900)) ||
        !(await limit("login-account", 30, 900))
      ) {
        res.setHeader("Retry-After", "900");
        return reply(res, 429, {
          error: "Лимит попыток входа. Подождите 15 минут.",
        });
      }
      const data = await body(req);
      const username = typeof data.username === "string" ? data.username : "";
      const password = typeof data.password === "string" ? data.password : "";
      if (username.length > 120 || password.length > 256)
        return reply(res, 400, { error: "Некорректные данные входа." });
      const correct = await verifyPassword(
        password,
        process.env.ADMIN_PASSWORD_HASH!,
      );
      if (!correct || !sameText(username, process.env.ADMIN_USERNAME!))
        return reply(res, 401, { error: "Неверный логин или пароль." });
      const token = newToken();
      await createSession(
        tokenHash(token),
        new Date(Date.now() + sessionSeconds * 1000),
      );
      res.setHeader("Set-Cookie", sessionCookie(token));
      return reply(res, 200, { authenticated: true });
    }
    if (!path.startsWith("/api/admin/"))
      return reply(res, 404, { error: "API не найден." });
    const token = readToken(req.headers.cookie);
    const authenticated =
      configured() && !!token && (await validSession(tokenHash(token)));
    if (path === "/api/admin/session" && req.method === "GET")
      return reply(res, 200, {
        authenticated,
        configured: configured(),
        storage: hasDatabase() ? "postgres" : "unconfigured",
      });
    if (!authenticated)
      return reply(res, 401, { error: "Требуется административный вход." });
    if (path === "/api/admin/logout" && req.method === "POST") {
      await revokeSession(tokenHash(token!));
      res.setHeader("Set-Cookie", sessionCookie("", true));
      return reply(res, 200, { authenticated: false });
    }
    if (path === "/api/admin/analytics" && req.method === "GET") {
      if (!hasDatabase())
        return reply(res, 200, {
          mode: "demo",
          storage: "unconfigured",
          events: [],
          truncated: false,
        });
      const url = new URL(req.url || "/", `http://${req.headers.host}`);
      const days = Number(url.searchParams.get("days") || 30);
      if (![7, 30, 90].includes(days))
        return reply(res, 400, {
          error: "Допустимый период: 7, 30 или 90 дней.",
        });
      return reply(res, 200, {
        mode: "server",
        storage: "postgres",
        ...(await readEvents(days)),
      });
    }
    return reply(res, 404, { error: "API не найден." });
  } catch (e) {
    const invalid =
      e instanceof SyntaxError ||
      (e instanceof Error &&
        ["INVALID_EVENTS", "BODY_TOO_LARGE"].includes(e.message));
    // Never include database errors, connection strings, credentials or event bodies in responses/logs.
    return reply(res, invalid ? 400 : 503, {
      error: invalid
        ? "Некорректный формат запроса."
        : "Сервис временно недоступен. Обучение и локальный прогресс продолжают работать.",
    });
  }
}
