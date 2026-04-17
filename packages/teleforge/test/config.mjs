import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { loadTeleforgeApp, resolveTeleforgeConfigPath } from "../dist/index.js";

test("resolveTeleforgeConfigPath finds teleforge.config.ts and loadTeleforgeApp parses it", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-config-"));

  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(
      pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href
    )};

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
      path: "/"
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
  assert.equal(loaded.appPath, path.join(tmpRoot, "teleforge.config.ts"));
});
