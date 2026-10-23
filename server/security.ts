import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCallback(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
export const cookieName = "__Host-productlab_admin";
export const sessionSeconds = 8 * 60 * 60;
export function configured() {
  return !!(
    process.env.ADMIN_USERNAME &&
    process.env.ADMIN_PASSWORD_HASH &&
    process.env.ADMIN_SESSION_SECRET?.length &&
    process.env.ADMIN_SESSION_SECRET.length >= 32
  );
}
export function fingerprint(value: string) {
  return createHmac(
    "sha256",
    process.env.ADMIN_SESSION_SECRET || randomBytes(32),
  )
    .update(value)
    .digest("hex");
}
export function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function newToken() {
  return randomBytes(32).toString("base64url");
}
export async function passwordHash(password: string) {
  const salt = randomBytes(24).toString("hex");
  const key = await derive(password, salt);
  return `scrypt$32768$8$1$${salt}$${key.toString("hex")}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [alg, n, r, p, salt, expected] = hash.split("$");
  if (
    alg !== "scrypt" ||
    n !== "32768" ||
    r !== "8" ||
    p !== "1" ||
    !/^\w{48}$/.test(salt || "") ||
    !/^\w{128}$/.test(expected || "")
  )
    return false;
  const key = await derive(password, salt);
  return timingSafeEqual(key, Buffer.from(expected, "hex"));
}
export function sameText(a: string, b: string) {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}
export function sessionCookie(token: string, clear = false) {
  return `${cookieName}=${clear ? "" : token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${clear ? 0 : sessionSeconds}`;
}
export function readToken(cookie: string | undefined) {
  const raw = cookie
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
  return raw && /^[A-Za-z0-9_-]{43}$/.test(raw) ? raw : null;
}
