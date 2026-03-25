import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const packageRoot = process.cwd();
const cliPath = path.join(packageRoot, "dist", "cli.js");

test("mock server exposes state, profiles, events, and export endpoints", async () => {
  const tempHome = await mkdtemp(path.join(os.tmpdir(), "teleforge-mock-home-"));
  const port = 45671;
  const child = spawn("node", [cliPath, "mock", "--headless", "--port", String(port)], {
    cwd: packageRoot,
    env: {
      ...process.env,
      TELEFORGE_HOME: tempHome
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const cleanup = async () => {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
    await new Promise((resolve) => child.once("exit", resolve));
  };

  try {
    await waitForServer(`http://127.0.0.1:${port}/api/mock/state`);

    const stateResponse = await fetch(`http://127.0.0.1:${port}/api/mock/state`);
    const statePayload = await stateResponse.json();
    assert.equal(statePayload.profile.name, "Default Profile");

    const headResponse = await fetch(`http://127.0.0.1:${port}/`, {
      method: "HEAD"
    });
    assert.equal(headResponse.status, 404);

    const updatedState = await fetch(`http://127.0.0.1:${port}/api/mock/state`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        name: "Premium User",
        user: {
          first_name: "Alex",
          is_premium: true
        },
        launchParams: {
          start_param: "checkout"
        }
      })
    }).then((response) => response.json());
    assert.equal(updatedState.profile.name, "Premium User");
    assert.equal(updatedState.profile.user.is_premium, true);

    const savedProfile = await fetch(`http://127.0.0.1:${port}/api/mock/profiles`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ name: "team-shared" })
    }).then((response) => response.json());
    assert.equal(savedProfile.profileRef.name, "team-shared");

    const profilesPayload = await fetch(`http://127.0.0.1:${port}/api/mock/profiles`).then(
      (response) => response.json()
    );
    assert.ok(profilesPayload.profiles.some((profile) => profile.fileName === "team-shared.json"));

    await fetch(`http://127.0.0.1:${port}/api/mock/events/trigger`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        name: "mainButtonClicked",
        payload: {
          source: "test"
        }
      })
    });
    const eventsPayload = await fetch(`http://127.0.0.1:${port}/api/mock/events/log`).then(
      (response) => response.json()
    );
    assert.equal(eventsPayload.events[0].name, "mainButtonClicked");

    const exportPayload = await fetch(`http://127.0.0.1:${port}/api/mock/export`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      }
    }).then((response) => response.json());
    assert.equal(exportPayload.version, "1.0");
    assert.equal(exportPayload.profile.name, "team-shared");
  } finally {
    await cleanup();
  }
});

test("mock server serves the web ui for GET and HEAD requests when not headless", async () => {
  const tempHome = await mkdtemp(path.join(os.tmpdir(), "teleforge-mock-home-"));
  const port = 45672;
  const child = spawn("node", [cliPath, "mock", "--port", String(port)], {
    cwd: packageRoot,
    env: {
      ...process.env,
      TELEFORGE_HOME: tempHome
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const cleanup = async () => {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
    await new Promise((resolve) => child.once("exit", resolve));
  };

  try {
    await waitForServer(`http://127.0.0.1:${port}/api/mock/state`);

    const getResponse = await fetch(`http://127.0.0.1:${port}/`);
    const html = await getResponse.text();
    assert.equal(getResponse.status, 200);
    assert.match(html, /Teleforge Mock Environment/);

    const headResponse = await fetch(`http://127.0.0.1:${port}/`, {
      method: "HEAD"
    });
    assert.equal(headResponse.status, 200);
    assert.equal(headResponse.headers.get("content-type"), "text/html; charset=utf-8");
  } finally {
    await cleanup();
  }
});

async function waitForServer(url) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10_000) {
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

  throw new Error("Timed out waiting for mock server");
}
