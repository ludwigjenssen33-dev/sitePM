import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const scrypt = promisify(scryptCallback);
export async function setupAdmin(root = process.cwd()) {
  const folder = resolve(root, ".private");
  const envFile = resolve(root, ".env.local");
  let previous = "";
  try {
    previous = await readFile(envFile, "utf8");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  if (
    /^(ADMIN_USERNAME|ADMIN_PASSWORD_HASH|ADMIN_SESSION_SECRET)=/m.test(
      previous,
    )
  )
    throw new Error(
      "Настройки администратора уже существуют. Первоначальная настройка не перезаписывает их.",
    );
  const username = "pl_" + randomBytes(12).toString("hex");
  const password = randomBytes(36).toString("base64url");
  const salt = randomBytes(24).toString("hex");
  const key = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 128 * 1024 * 1024,
  });
  const hash = `scrypt$32768$8$1$${salt}$${key.toString("hex")}`;
  const secret = randomBytes(48).toString("base64url");
  // dotenv expands $, so the local hash escapes dollar signs. Vercel UI uses the unescaped file.
  const env = `ADMIN_USERNAME=${username}\nADMIN_PASSWORD_HASH='${hash.replaceAll("$", "\\$")}'\nADMIN_SESSION_SECRET=${secret}\n`;
  await mkdir(folder, { recursive: true, mode: 0o700 });
  await chmod(folder, 0o700);
  await writeFile(
    resolve(folder, "admin-credentials.json"),
    JSON.stringify(
      {
        username,
        password,
        scope:
          "Локальная настройка; Vercel требует установки серверных переменных.",
      },
      null,
      2,
    ),
    { mode: 0o600, flag: "wx" },
  );
  await writeFile(envFile, previous + "\n" + env, { mode: 0o600 });
  await chmod(envFile, 0o600);
  await writeFile(
    resolve(folder, "vercel-admin.env"),
    `ADMIN_USERNAME=${username}\nADMIN_PASSWORD_HASH=${hash}\nADMIN_SESSION_SECRET=${secret}\n`,
    { mode: 0o600, flag: "wx" },
  );
  return {
    credentialsFile: resolve(folder, "admin-credentials.json"),
    environmentFile: envFile,
  };
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  try {
    const result = await setupAdmin();
    console.log(
      "Локальная настройка готова. Данные входа: " + result.credentialsFile,
    );
    console.log(
      "Для Vercel: .private/vercel-admin.env. Файлы исключены из Git.",
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
