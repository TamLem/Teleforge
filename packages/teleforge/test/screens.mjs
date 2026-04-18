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
  executeMiniAppStepAction,
  executeMiniAppStepSubmit,
  loadMiniAppScreenRuntime,
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

test("loadMiniAppScreenRuntime evaluates screen guards and loaders", async () => {
  const flow = defineFlow({
    id: "checkout",
    initialStep: "address",
    state: {
      userId: "u_123"
    },
    miniApp: {
      route: "/checkout"
    },
    steps: {
      address: {
        screen: "checkout.address",
        type: "miniapp"
      }
    }
  });
  const allowedScreen = defineScreen({
    async guard(context) {
      return context.state.userId === "u_123";
    },
    loader(context) {
      return {
        heading: `Address for ${context.flowId}`
      };
    },
    component: () => null,
    id: "checkout.address"
  });

  const resolution = resolveMiniAppScreen({
    flows: [flow],
    pathname: "/checkout",
    screens: [allowedScreen]
  });

  assert.ok(!("reason" in resolution));

  const runtime = await loadMiniAppScreenRuntime(resolution);
  assert.equal(runtime.status, "ready");
  assert.deepEqual(runtime.loaderData, {
    heading: "Address for checkout"
  });
});

test("loadMiniAppScreenRuntime blocks screens when the guard fails", async () => {
  const flow = defineFlow({
    id: "billing",
    initialStep: "card",
    state: {},
    miniApp: {
      route: "/billing"
    },
    steps: {
      card: {
        screen: "billing.card",
        type: "miniapp"
      }
    }
  });
  const guardedScreen = defineScreen({
    guard() {
      return {
        allow: false,
        reason: "Billing details are not available yet."
      };
    },
    component: () => null,
    id: "billing.card"
  });

  const resolution = resolveMiniAppScreen({
    flows: [flow],
    pathname: "/billing",
    screens: [guardedScreen]
  });

  assert.ok(!("reason" in resolution));

  const runtime = await loadMiniAppScreenRuntime(resolution);
  assert.equal(runtime.status, "blocked");
  assert.equal(runtime.block.reason, "Billing details are not available yet.");
});

test("executeMiniAppStepSubmit advances Mini App flows into the next screen", async () => {
  const flow = defineFlow({
    id: "checkout",
    initialStep: "cart",
    state: {
      itemId: null
    },
    miniApp: {
      route: "/checkout",
      stepRoutes: {
        confirm: "/checkout/confirm"
      }
    },
    steps: {
      cart: {
        onSubmit({ data, state }) {
          return {
            state: {
              ...state,
              itemId: data.itemId
            },
            to: "confirm"
          };
        },
        screen: "checkout.cart",
        type: "miniapp"
      },
      confirm: {
        screen: "checkout.confirm",
        type: "miniapp"
      }
    }
  });
  const cartScreen = defineScreen({
    component: () => null,
    id: "checkout.cart"
  });
  const confirmScreen = defineScreen({
    component: () => null,
    id: "checkout.confirm"
  });
  const resolution = resolveMiniAppScreen({
    flows: [flow],
    pathname: "/checkout",
    screens: [cartScreen, confirmScreen]
  });

  assert.ok(!("reason" in resolution));

  const result = await executeMiniAppStepSubmit({
    data: {
      itemId: "sku_123"
    },
    resolution
  });

  assert.equal(result.target, "miniapp");
  assert.equal(result.stepId, "confirm");
  assert.equal(result.screenId, "checkout.confirm");
  assert.equal(result.routePath, "/checkout/confirm");
  assert.deepEqual(result.state, {
    itemId: "sku_123"
  });
});

test("executeMiniAppStepAction resolves discovered handler actions for Mini App steps", async () => {
  const flow = defineFlow({
    id: "inventory",
    initialStep: "catalog",
    state: {
      refreshed: false
    },
    miniApp: {
      route: "/inventory"
    },
    steps: {
      catalog: {
        actions: [
          {
            id: "refresh",
            label: "Refresh"
          }
        ],
        screen: "inventory.catalog",
        type: "miniapp"
      },
      done: {
        message: "Done",
        type: "chat"
      }
    }
  });
  const catalogScreen = defineScreen({
    component: () => null,
    id: "inventory.catalog"
  });
  const resolution = resolveMiniAppScreen({
    flows: [flow],
    pathname: "/inventory",
    screens: [catalogScreen]
  });

  assert.ok(!("reason" in resolution));

  const result = await executeMiniAppStepAction({
    action: "refresh",
    handlers: [
      {
        actions: {
          refresh({ state }) {
            return {
              state: {
                ...state,
                refreshed: true
              },
              to: "done"
            };
          }
        },
        filePath: "apps/bot/src/flow-handlers/inventory/catalog.ts",
        flowId: "inventory",
        stepId: "catalog"
      }
    ],
    resolution
  });

  assert.equal(result.target, "chat");
  assert.equal(result.stepId, "done");
  assert.deepEqual(result.state, {
    refreshed: true
  });
});
