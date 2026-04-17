import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { loadManifest } from "../dist/index.js";

test("loadManifest supports teleforge.config.ts deriving routes from imported flows", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-devtools-manifest-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const teleforgeIndexUrl = pathToFileURL(
    path.join(process.cwd(), "packages", "teleforge", "src", "index.ts")
  ).href;

  await mkdir(flowsRoot, { recursive: true });
  await writeFile(
    path.join(flowsRoot, "start.flow.ts"),
    `import { defineFlow } from ${JSON.stringify(teleforgeIndexUrl)};

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
    `import { createFlowRoutes, defineTeleforgeApp } from ${JSON.stringify(teleforgeIndexUrl)};
import startFlow from "./apps/bot/src/flows/start.flow.ts";

export default defineTeleforgeApp({
  app: {
    id: "devtools-flow-app",
    name: "Devtools Flow App",
    version: "1.0.0"
  },
  flows: {
    root: "apps/bot/src/flows"
  },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "devtools_flow_bot",
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
  routes: createFlowRoutes({
    flows: [startFlow]
  }),
  runtime: {
    mode: "spa",
    webFramework: "vite"
  }
});
`
  );

  const loaded = await loadManifest(tmpRoot);

  assert.equal(loaded.manifest.id, "devtools-flow-app");
  assert.equal(loaded.manifest.routes.length, 1);
  assert.equal(loaded.manifest.routes[0]?.path, "/");
  assert.equal(loaded.manifest.routes[0]?.component, "pages/Home");
  assert.equal(loaded.manifest.routes[0]?.coordination?.flow?.flowId, "start");
});
