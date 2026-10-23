import { beforeAll, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  cookieName,
  newToken,
  passwordHash,
  readToken,
  sameText,
  sessionCookie,
  tokenHash,
  verifyPassword,
} from "./security";
let password: string, hash: string;
beforeAll(async () => {
  password = randomBytes(36).toString("base64url");
  hash = await passwordHash(password);
});
it("scrypt хранит соль и хеш, не исходный пароль", async () => {
  expect(hash).not.toContain(password);
  expect(await verifyPassword(password, hash)).toBe(true);
  expect(await verifyPassword(randomBytes(24).toString("hex"), hash)).toBe(
    false,
  );
  expect(await verifyPassword(password, "malformed")).toBe(false);
});
it("один пароль получает разные соли", async () => {
  expect(await passwordHash(password)).not.toBe(hash);
});
it("сессионные cookie закрыты для JS и межсайтовых запросов", () => {
  const token = newToken();
  expect(token.length).toBe(43);
  expect(tokenHash(token)).not.toContain(token);
  const cookie = sessionCookie(token);
  expect(cookie).toContain("HttpOnly; Secure; SameSite=Strict");
  expect(cookie).toContain("Path=/");
  expect(cookie).not.toContain("Domain=");
  expect(readToken(cookie)).toBe(token);
  expect(readToken(`${cookieName}=admin`)).toBeNull();
  expect(sessionCookie("", true)).toContain("Max-Age=0");
  expect(sameText("abc", "def")).toBe(false);
});
