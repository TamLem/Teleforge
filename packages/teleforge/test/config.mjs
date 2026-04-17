import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { loadTeleforgeApp, resolveTeleforgeConfigPath } from "../dist/index.js";

test("resolveTeleforgeConfigPath finds teleforge.config.ts and loadTeleforgeApp derives flow routes", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-config-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await writeFile(
    path.join(flowsRoot, "start.flow.ts"),
    `import { defineFlow } from ${JSON.stringify(distIndexUrl)};

export default defineFlow({
  id: "start",
  initialStep: "home",
  state: {},
  bot: {
    command: {
      command: "start",
      description: "Open app",
      text: "Open app"
    }
  },
  miniApp: {
    component: "pages/Home",
    launchModes: ["inline", "compact", "fullscreen"],
    route: "/"
  },
  steps: {
    home: {
      screen: "home",
      type: "miniapp"
    }
  }
});
`
  );

  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: {
    id: "sample-app",
    name: "Sample App",
    version: "1.0.0"
  },
  flows: {
    root: "apps/bot/src/flows"
  },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "sample_bot",
    webhook: {
      path: "/api/webhook",
      secretEnv: "WEBHOOK_SECRET"
    }
  },
  miniApp: {
    capabilities: ["read_access"],
    defaultMode: "inline",
    entry: "apps/web/src/main.tsx",
    launchModes: ["inline", "compact", "fullscreen"]
  },
  routes: [
    {
      path: "/settings",
      component: "pages/Settings"
    }
  ],
  runtime: {
    mode: "spa",
    webFramework: "vite"
  }
});
`
  );

  const configPath = await resolveTeleforgeConfigPath(tmpRoot);
  assert.equal(configPath, path.join(tmpRoot, "teleforge.config.ts"));

  const loaded = await loadTeleforgeApp(tmpRoot);

  assert.equal(loaded.app.app.id, "sample-app");
  assert.equal(loaded.app.flows?.root, "apps/bot/src/flows");
  assert.equal(loaded.app.routes?.length, 2);
  assert.equal(loaded.app.routes?.[0]?.path, "/settings");
  assert.equal(loaded.app.routes?.[1]?.path, "/");
  assert.equal(loaded.app.routes?.[1]?.component, "pages/Home");
  assert.equal(loaded.appPath, path.join(tmpRoot, "teleforge.config.ts"));
});
