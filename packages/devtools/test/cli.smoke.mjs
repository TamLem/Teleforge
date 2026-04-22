import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const packageRoot = process.cwd();
const cliPath = path.join(packageRoot, "dist", "cli.js");

test("fails with a clear error when teleforge config is missing", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-devtools-"));

  const result = spawnSync("node", [cliPath, "dev"], { cwd: tmpRoot, encoding: "utf8" });
  assert.notEqual(result.status, 0, "Expected CLI to exit non-zero when config is missing");
  assert.match(
    (result.stdout || "") + (result.stderr || ""),
    /No Teleforge project found/,
    "Expected CLI to report missing config error"
  );
});

test("fails with the same clear error for dev:https when teleforge config is missing", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-devtools-https-"));

  const result = spawnSync("node", [cliPath, "dev:https"], { cwd: tmpRoot, encoding: "utf8" });
  assert.notEqual(result.status, 0, "Expected CLI to exit non-zero when config is missing");
  assert.match(
    (result.stdout || "") + (result.stderr || ""),
    /No Teleforge project found/,
    "Expected CLI to report missing config error"
  );
});
