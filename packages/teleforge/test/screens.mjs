import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import {
  defineFlow,
  defineScreen,
  discoverScreenFiles,
  loadTeleforgeScreens,
  resolveMiniAppScreen
} from "../dist/index.js";

test("discoverScreenFiles and loadTeleforgeScreens read convention-based screen modules", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-screens-"));
  const screensRoot = path.join(tmpRoot, "apps", "web", "src", "screens");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(screensRoot, { recursive: true });
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: {
    id: "screen-app",
    name: "Screen App",
    version: "1.0.0"
  },
  flows: {
    root: "apps/bot/src/flows"
  },
  runtime: {
    mode: "spa",
    webFramework: "vite"
  },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "screen_app_bot",
    webhook: {
      path: "/api/webhook",
      secretEnv: "WEBHOOK_SECRET"
    }
  },
  miniApp: {
    entry: "apps/web/src/main.tsx",
    launchModes: ["inline", "compact", "fullscreen"],
    defaultMode: "inline",
    capabilities: ["read_access"]
  }
});
`
  );
  await writeFile(
    path.join(screensRoot, "home.screen.mjs"),
    `import { defineScreen } from ${JSON.stringify(distIndexUrl)};

export default defineScreen({
  component: () => null,
  id: "home"
});
`
  );

  const files = await discoverScreenFiles({
    app: {
      miniApp: {
        entry: "apps/web/src/main.tsx"
      }
    },
    cwd: tmpRoot
  });

  assert.equal(files.length, 1);
  assert.match(files[0], /home\.screen\.mjs$/);

  const screens = await loadTeleforgeScreens({
    app: {
      miniApp: {
        entry: "apps/web/src/main.tsx"
      }
    },
    cwd: tmpRoot
  });

  assert.equal(screens.length, 1);
  assert.equal(screens[0]?.screen.id, "home");
});

test("resolveMiniAppScreen resolves flow routes to registered screens", () => {
  const flow = defineFlow({
    id: "catalog",
    initialStep: "home",
    state: {
      ready: true
    },
    miniApp: {
      route: "/catalog",
      stepRoutes: {
        detail: "/catalog/detail"
      }
    },
    steps: {
      home: {
        screen: "catalog.home",
        type: "miniapp"
      },
      detail: {
        screen: "catalog.detail",
        type: "miniapp"
      }
    }
  });
  const homeScreen = defineScreen({
    component: () => null,
    id: "catalog.home"
  });
  const detailScreen = defineScreen({
    component: () => null,
    id: "catalog.detail"
  });

  const entryResolution = resolveMiniAppScreen({
    flows: [flow],
    pathname: "/catalog",
    screens: [homeScreen, detailScreen]
  });
  const detailResolution = resolveMiniAppScreen({
    flows: [flow],
    pathname: "/catalog/detail",
    screens: [homeScreen, detailScreen]
  });
  const missingResolution = resolveMiniAppScreen({
    flows: [flow],
    pathname: "/missing",
    screens: [homeScreen]
  });

  assert.equal(entryResolution.stepId, "home");
  assert.equal(entryResolution.screenId, "catalog.home");
  assert.equal(detailResolution.stepId, "detail");
  assert.equal(detailResolution.screenId, "catalog.detail");
  assert.equal(missingResolution.reason, "missing_route");
});
