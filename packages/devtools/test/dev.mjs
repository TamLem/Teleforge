import test from "node:test";
import assert from "node:assert/strict";
import { chmod, cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const packageRoot = process.cwd();
const cliPath = path.join(packageRoot, "dist", "cli.js");
const fixtureRoot = path.join(packageRoot, "..", "..", "generated", "spa-dev-check");

test("dev injects the Telegram mock overlay, logs .env.local, and opens the browser once", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-dev-command-"));
  const projectRoot = path.join(tempRoot, "project");
  const binRoot = path.join(tempRoot, "bin");
  const openLogPath = path.join(tempRoot, "open.log");
  const port = 43127;

  await cp(fixtureRoot, projectRoot, {
    filter(source) {
      return !source.split(path.sep).includes("node_modules");
    },
    recursive: true
  });
  await symlink(
    path.join(fixtureRoot, "apps", "web", "node_modules"),
    path.join(projectRoot, "apps", "web", "node_modules"),
    "dir"
  );
  await writeFile(path.join(projectRoot, ".env.local"), "TELEFORGE_LABEL=local-override\n");
  await mkdir(binRoot, { recursive: true });
  await writeFile(
    path.join(binRoot, "xdg-open"),
    `#!/bin/sh
printf '%s\n' "$1" >> "$TELEFORGE_OPEN_LOG"
`
  );
  await chmod(path.join(binRoot, "xdg-open"), 0o755);

  let stdout = "";
  let stderr = "";

  const child = spawn("node", [cliPath, "dev", "--no-https", "--open", "--port", String(port)], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PATH: `${binRoot}:${process.env.PATH ?? ""}`,
      TELEFORGE_OPEN_LOG: openLogPath
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  const cleanup = async () => {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
    await new Promise((resolve) => child.once("exit", resolve));
    await rm(tempRoot, { force: true, recursive: true });
  };

  try {
    await waitForServer(`http://127.0.0.1:${port}`);
    await waitForOutput(() => stdout.includes(".env.local"), stdout, stderr);
    await waitForOutput(() => stdout.includes("Opened http://localhost:"), stdout, stderr);

    const html = await fetch(`http://127.0.0.1:${port}`).then((response) => response.text());
    const openLog = await readFile(openLogPath, "utf8");

    assert.match(html, /data-teleforge-mock="true"/);
    assert.match(stdout, /Loaded env overrides from \.env\.local/);
    assert.match(openLog, new RegExp(`http://localhost:${port}`));
  } finally {
    await cleanup();
  }
});

test("help text advertises the --open flag", async () => {
  const child = spawn("node", [cliPath], {
    cwd: packageRoot,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
  });

  const exitCode = await new Promise((resolve) => child.once("exit", resolve));
  assert.equal(exitCode, 0);
  assert.match(stdout, /--open\s+Open the dev URL in the default browser/);
});

test("dev starts companion app services with the resolved Mini App URL", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-dev-services-"));
  const projectRoot = path.join(tempRoot, "project");
  const binRoot = path.join(tempRoot, "bin");
  const serviceLogPath = path.join(tempRoot, "services.log");
  const port = 43128;

  await cp(fixtureRoot, projectRoot, {
    filter(source) {
      return !source.split(path.sep).includes("node_modules");
    },
    recursive: true
  });
  await symlink(
    path.join(fixtureRoot, "apps", "web", "node_modules"),
    path.join(projectRoot, "apps", "web", "node_modules"),
    "dir"
  );
  await mkdir(binRoot, { recursive: true });
  await writeFile(
    path.join(binRoot, "pnpm"),
    `#!/bin/sh
printf '%s|%s|%s\\n' "$PWD" "$*" "$MINI_APP_URL" >> "$TELEFORGE_SERVICE_LOG"
trap 'exit 0' TERM INT
while :; do
  sleep 1
done
`
  );
  await chmod(path.join(binRoot, "pnpm"), 0o755);

  let stdout = "";
  let stderr = "";

  const child = spawn("node", [cliPath, "dev", "--no-https", "--port", String(port)], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PATH: `${binRoot}:${process.env.PATH ?? ""}`,
      TELEFORGE_SERVICE_LOG: serviceLogPath
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  const cleanup = async () => {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
    await new Promise((resolve) => child.once("exit", resolve));
    await rm(tempRoot, { force: true, recursive: true });
  };

  try {
    await waitForServer(`http://127.0.0.1:${port}`);
    await waitForOutput(() => stdout.includes("Companion services active:"), stdout, stderr);
    await waitForFile(serviceLogPath);

    const log = await readFile(serviceLogPath, "utf8");

    assert.match(stdout, /Companion services active: bot/);
    assert.doesNotMatch(log, /apps[/\\]api\|dev\|/);
    assert.match(log, new RegExp(`apps[/\\\\]bot\\|dev\\|http://localhost:${port}`));
  } finally {
    await cleanup();
  }
});

async function waitForServer(url) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15_000) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Poll until the server is ready or the timeout elapses.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForOutput(predicate, stdout, stderr) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10_000) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timed out waiting for expected output.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
}

async function waitForFile(filePath) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10_000) {
    try {
      const contents = await readFile(filePath, "utf8");
      if (contents.length > 0) {
        return;
      }
    } catch {
      // Poll until the file is created.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timed out waiting for ${filePath}`);
}
