import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const packageRoot = process.cwd();
const cliPath = path.join(packageRoot, "dist", "cli.js");

function runCLI(args, cwd, env = {}) {
  return new Promise((resolve) => {
    const child = spawn("node", [cliPath, ...args], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += String(data);
    });
    child.stderr.on("data", (data) => {
      stderr += String(data);
    });

    child.on("close", (code) => {
      resolve({ code, stderr, stdout });
    });

    child.on("error", (error) => {
      resolve({ code: -1, stderr: String(error), stdout });
    });
  });
}

test("teleforge start runs preview mode and exits gracefully on SIGTERM", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-start-smoke-"));
  const flowsRoot = path.join(tmpRoot, "flows");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: { id: "cli-start", name: "CLI Start", version: "1.0.0" },
  flows: { root: "flows" },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "cli_start_bot",
    webhook: { path: "/api/webhook", secretEnv: "WEBHOOK_SECRET" }
  },
  miniApp: {
    capabilities: ["read_access"],
    defaultMode: "inline",
    entry: "apps/web/src/main.tsx",
    launchModes: ["inline", "compact", "fullscreen"]
  },
  runtime: {}
});
`
  );
  await writeFile(
    path.join(flowsRoot, "start.flow.mjs"),
    `import { defineFlow } from ${JSON.stringify(distIndexUrl)};

export default defineFlow({
  id: "start",
  initialStep: "home",
  state: {},
  bot: {
    command: {
      buttonText: "Open",
      command: "start",
      description: "Start",
      text: "Welcome"
    }
  },
  miniApp: { route: "/" },
  steps: {
    home: { screen: "home", type: "miniapp" }
  }
});
`
  );

  // Use `timeout` to send SIGTERM after 12 seconds so we can observe startup and shutdown.
  // A generous timeout is needed because test concurrency can delay child-process startup.
  const child = spawn("timeout", ["12", "node", cliPath, "start"], {
    cwd: tmpRoot,
    env: { ...process.env, BOT_TOKEN: "" },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (data) => {
    stdout += String(data);
  });
  child.stderr.on("data", (data) => {
    stderr += String(data);
  });

  const exitCode = await new Promise((resolve) => {
    child.on("close", (code) => resolve(code));
    child.on("error", () => resolve(-1));
  });

  const output = stdout + stderr;
  assert.match(output, /BOT_TOKEN missing, running in preview mode/);
  assert.match(output, /bot running \(1 command\(s\) registered\)/);
  assert.match(output, /shutting down/);

  // timeout exits 124 when it sends the signal; the Node process itself should exit 0
  // after the SIGTERM handler, but timeout reports 124.
  assert.ok(exitCode === 124 || exitCode === 0, `Unexpected exit code: ${exitCode}`);
});

test("teleforge start fails fast when config is missing", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-start-no-config-"));

  const result = await runCLI(["start"], tmpRoot);

  assert.notEqual(result.code, 0, "Expected CLI to exit non-zero when config is missing");
  assert.match(
    result.stdout + result.stderr,
    /teleforge\.config/,
    "Expected CLI to report missing config error"
  );
});
