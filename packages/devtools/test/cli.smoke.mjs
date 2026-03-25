import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const packageRoot = process.cwd();
const cliPath = path.join(packageRoot, "dist", "cli.js");

test("fails with a clear error when teleforge.app.json is missing", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-devtools-"));

  await assert.rejects(
    execFileAsync("node", [cliPath, "dev"], { cwd: tmpRoot }),
    (error) => {
      assert.match(error.stderr, /No Teleforge project found/);
      return true;
    }
  );
});

test("fails with the same clear error for dev:https when teleforge.app.json is missing", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-devtools-https-"));

  await assert.rejects(
    execFileAsync("node", [cliPath, "dev:https"], { cwd: tmpRoot }),
    (error) => {
      assert.match(error.stderr, /No Teleforge project found/);
      return true;
    }
  );
});
