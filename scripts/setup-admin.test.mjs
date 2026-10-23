import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupAdmin } from "./setup-admin.mjs";
test("initial setup is private, random and refuses to overwrite", async () => {
  const root = await mkdtemp(join(tmpdir(), "productlab-admin-"));
  try {
    const result = await setupAdmin(root);
    const credentials = JSON.parse(
      await readFile(result.credentialsFile, "utf8"),
    );
    assert.match(credentials.username, /^pl_[a-f0-9]{24}$/);
    assert.ok(credentials.password.length >= 24);
    const env = await readFile(result.environmentFile, "utf8");
    assert.ok(env.includes("ADMIN_PASSWORD_HASH="));
    assert.ok(!env.includes(credentials.password));
    assert.equal((await stat(result.credentialsFile)).mode & 0o777, 0o600);
    assert.equal((await stat(result.environmentFile)).mode & 0o777, 0o600);
    await assert.rejects(setupAdmin(root), /уже существуют/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
