import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import {
  UserFlowStateManager,
  createFlowStorage,
  createDiscoveredServerHooksHandler,
  createFetchMiniAppServerBridge,
  defineFlow,
  defineScreen,
  executeMiniAppStepAction,
  executeMiniAppStepSubmit,
  loadMiniAppScreenRuntime,
  resolveMiniAppScreen
} from "../dist/index.js";
import {
  createDiscoveredServerHooksHandler as createHandlerFromSubpath,
  createFetchMiniAppServerBridge as createBridgeFromSubpath,
  executeTeleforgeServerHookAction,
  executeTeleforgeServerHookLoad,
  executeTeleforgeServerHookSubmit
} from "../dist/server-hooks.js";

test("loadMiniAppScreenRuntime exposes server loader data to local screen loaders", async () => {
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
  const screen = defineScreen({
    component: () => null,
    id: "checkout.address",
    loader(context) {
      return {
        heading: `${context.serverLoaderData.heading}!`
      };
    }
  });
  const resolution = resolveMiniAppScreen({
    flows: [flow],
    pathname: "/checkout",
    screens: [screen]
  });

  assert.ok(!("reason" in resolution));

  const runtime = await loadMiniAppScreenRuntime(resolution, {
    serverBridge: {
      async action() {
        return undefined;
      },
      async load() {
        return {
          allow: true,
          loaderData: {
            heading: "Server heading"
          }
        };
      },
      async submit() {
        return undefined;
      }
    }
  });

  assert.equal(runtime.status, "ready");
  assert.deepEqual(runtime.loaderData, {
    heading: "Server heading!"
  });
});

test("executeMiniAppStepSubmit and executeMiniAppStepAction honor the configured server bridge", async () => {
  const flow = defineFlow({
    id: "inventory",
    initialStep: "catalog",
    state: {
      itemId: null,
      refreshed: false
    },
    miniApp: {
      route: "/inventory",
      stepRoutes: {
        confirm: "/inventory/confirm"
      }
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
      confirm: {
        screen: "inventory.confirm",
        type: "miniapp"
      },
      done: {
        message: "Done",
        type: "chat"
      }
    }
  });
  const resolution = resolveMiniAppScreen({
    flows: [flow],
    pathname: "/inventory",
    screens: [
      defineScreen({
        component: () => null,
        id: "inventory.catalog"
      }),
      defineScreen({
        component: () => null,
        id: "inventory.confirm"
      })
    ]
  });

  assert.ok(!("reason" in resolution));

  const serverBridge = {
    async action() {
      return {
        state: {
          itemId: null,
          refreshed: true
        },
        to: "done"
      };
    },
    async load() {
      return {
        allow: true
      };
    },
    async submit() {
      return {
        state: {
          itemId: "sku_server",
          refreshed: false
        },
        to: "confirm"
      };
    }
  };

  const submitResult = await executeMiniAppStepSubmit({
    data: {
      itemId: "sku_client"
    },
    resolution,
    serverBridge
  });
  const actionResult = await executeMiniAppStepAction({
    action: "refresh",
    resolution,
    serverBridge
  });

  assert.equal(submitResult.target, "miniapp");
  assert.equal(submitResult.stepId, "confirm");
  assert.equal(submitResult.routePath, "/inventory/confirm");
  assert.deepEqual(submitResult.state, {
    itemId: "sku_server",
    refreshed: false
  });

  assert.equal(actionResult.target, "chat");
  assert.equal(actionResult.stepId, "done");
  assert.deepEqual(actionResult.state, {
    itemId: null,
    refreshed: true
  });
});

test("createDiscoveredServerHooksHandler serves convention-discovered flow hooks through the fetch bridge", async () => {
  const fixture = await createDiscoveredServerHookFixture();
  const bridge = fixture.createBridge();

  const loadResult = await bridge.load({
    flowId: "inventory",
    routePath: "/inventory",
    screenId: "inventory.catalog",
    state: {
      itemId: null,
      refreshed: false
    },
    stepId: "catalog"
  });
  const submitResult = await bridge.submit({
    data: {
      itemId: "sku_123"
    },
    flowId: "inventory",
    state: {
      itemId: null,
      refreshed: false
    },
    stepId: "catalog"
  });
  const actionResult = await bridge.action({
    action: "refresh",
    flowId: "inventory",
    state: {
      itemId: null,
      refreshed: false
    },
    stepId: "catalog"
  });

  assert.deepEqual(loadResult, {
    allow: true,
    loaderData: {
      heading: "Authoritative inventory"
    },
    state: {
      itemId: null,
      refreshed: false
    }
  });
  assert.deepEqual(submitResult, {
    state: {
      itemId: "sku_123",
      refreshed: false
    },
    to: "confirm"
  });
  assert.deepEqual(actionResult, {
    state: {
      itemId: null,
      refreshed: true
    },
    to: "done"
  });
});

test("createDiscoveredServerHooksHandler enforces trusted actor ownership and state keys", async () => {
  const flowState = new UserFlowStateManager(
    createFlowStorage({
      backend: "memory",
      defaultTTL: 900,
      namespace: "teleforge-server-hooks-trust-test"
    })
  );
  const { key: stateKey } = await flowState.startInstance("user_1", "inventory", "catalog", {
    itemId: null,
    refreshed: false
  });
  const fixture = await createDiscoveredServerHookFixture({
    trust: {
      flowState,
      requireActor: true,
      requireStateKey: true,
      resolveActorId(request) {
        return request.headers.get("x-actor-id");
      }
    }
  });

  const anonymousBridge = fixture.createBridge();
  const foreignBridge = fixture.createBridge({
    "x-actor-id": "user_2"
  });
  const ownerBridge = fixture.createBridge({
    "x-actor-id": "user_1"
  });

  await assert.rejects(
    async () =>
      anonymousBridge.submit({
        data: {
          itemId: "sku_1"
        },
        flowId: "inventory",
        state: {
          itemId: null,
          refreshed: false
        },
        stateKey,
        stepId: "catalog"
      }),
    /requires an authenticated actor/
  );

  await assert.rejects(
    async () =>
      ownerBridge.submit({
        data: {
          itemId: "sku_1"
        },
        flowId: "inventory",
        state: {
          itemId: null,
          refreshed: false
        },
        stepId: "catalog"
      }),
    /requires a stateKey/
  );

  await assert.rejects(
    async () =>
      foreignBridge.submit({
        data: {
          itemId: "sku_1"
        },
        flowId: "inventory",
        state: {
          itemId: null,
          refreshed: false
        },
        stateKey,
        stepId: "catalog"
      }),
    /does not own flow state/
  );

  await assert.rejects(
    async () =>
      ownerBridge.submit({
        data: {
          itemId: "sku_1"
        },
        flowId: "inventory",
        state: {
          itemId: "stale",
          refreshed: false
        },
        stateKey,
        stepId: "catalog"
      }),
    /does not match the provided runtime state/
  );

  const result = await ownerBridge.submit({
    data: {
      itemId: "sku_999"
    },
    flowId: "inventory",
    state: {
      itemId: null,
      refreshed: false
    },
    stateKey,
    stepId: "catalog"
  });

  assert.deepEqual(result, {
    state: {
      itemId: "sku_999",
      refreshed: false
    },
    to: "confirm"
  });
});

async function createDiscoveredServerHookFixture(options = {}) {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-server-hooks-"));
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(path.join(tmpRoot, "apps", "bot", "src", "flows"), {
    recursive: true
  });
  await mkdir(path.join(tmpRoot, "apps", "api", "src", "flow-hooks", "inventory"), {
    recursive: true
  });
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: {
    id: "server-hooks-app",
    name: "Server Hooks App",
    version: "1.0.0"
  },
  flows: {
    root: "apps/bot/src/flows",
    serverHooksRoot: "apps/api/src/flow-hooks"
  },
  runtime: {
  },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "server_hooks_bot",
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
    path.join(tmpRoot, "apps", "bot", "src", "flows", "inventory.flow.mjs"),
    `import { defineFlow } from ${JSON.stringify(distIndexUrl)};

export default defineFlow({
  id: "inventory",
  initialStep: "catalog",
  state: {
    itemId: null,
    refreshed: false
  },
  bot: {
    command: {
      command: "inventory",
      description: "Open inventory",
      text: "Open inventory"
    }
  },
  miniApp: {
    route: "/inventory",
    stepRoutes: {
      confirm: "/inventory/confirm"
    }
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
    confirm: {
      screen: "inventory.confirm",
      type: "miniapp"
    },
    done: {
      message: "Done",
      type: "chat"
    }
  }
});
`
  );
  await writeFile(
    path.join(tmpRoot, "apps", "api", "src", "flow-hooks", "inventory", "catalog.mjs"),
    `export function guard() {
  return true;
}

export function loader() {
  return {
    heading: "Authoritative inventory"
  };
}

export function onSubmit({ state, data }) {
  return {
    state: {
      ...state,
      itemId: data.itemId
    },
    to: "confirm"
  };
}

export const actions = {
  refresh({ state }) {
    return {
      state: {
        ...state,
        refreshed: true
      },
      to: "done"
    };
  }
};
`
  );

  const handler = await createDiscoveredServerHooksHandler({
    cwd: tmpRoot,
    ...options
  });

  return {
    createBridge(headers) {
      return createFetchMiniAppServerBridge({
        async fetch(input, init) {
          const request = new Request(`https://example.com${String(input)}`, init);
          const response = await handler(request);
          return response ?? new Response("Missing route", { status: 404 });
        },
        headers
      });
    }
  };
}

test("teleforge/server-hooks subpath exports expected server-hook functions", () => {
  assert.equal(typeof createHandlerFromSubpath, "function");
  assert.equal(typeof createBridgeFromSubpath, "function");
  assert.equal(typeof executeTeleforgeServerHookLoad, "function");
  assert.equal(typeof executeTeleforgeServerHookSubmit, "function");
  assert.equal(typeof executeTeleforgeServerHookAction, "function");
  assert.equal(typeof createHandlerFromSubpath, "function");
  assert.equal(typeof createBridgeFromSubpath, "function");
});
