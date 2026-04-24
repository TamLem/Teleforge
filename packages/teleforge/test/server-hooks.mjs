import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import http from "node:http";

import {
  UserFlowStateManager,
  createFlowStorage,
  createDiscoveredServerHooksHandler,
  createFetchMiniAppServerBridge,
  createTeleforgeWebhookHandler,
  defineFlow,
  defineScreen,
  executeMiniAppStepAction,
  executeMiniAppStepSubmit,
  loadMiniAppScreenRuntime,
  resolveMiniAppScreen,
  startTeleforgeServer
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

test("startTeleforgeServer starts a hooks HTTP server and serves load requests", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-start-server-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const hooksRoot = path.join(tmpRoot, "apps", "api", "src", "flow-hooks", "checkout");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await mkdir(hooksRoot, { recursive: true });
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: { id: "start-server-app", name: "Start Server App", version: "1.0.0" },
  flows: { root: "apps/bot/src/flows" },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "server_bot",
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
    path.join(flowsRoot, "checkout.flow.mjs"),
    `import { defineFlow } from ${JSON.stringify(distIndexUrl)};
export default defineFlow({
  id: "checkout",
  initialStep: "address",
  state: { userId: "u_123" },
  miniApp: { route: "/checkout" },
  steps: {
    address: { screen: "checkout.address", type: "miniapp" }
  }
});
`
  );
  await writeFile(
    path.join(hooksRoot, "address.mjs"),
    `export const guard = () => true;
export const loader = () => ({ heading: "Server heading" });
`
  );

  const { port, stop, url } = await startTeleforgeServer({
    cwd: tmpRoot,
    port: 0 // Let OS assign an available port
  });

  assert.ok(typeof port === "number");
  assert.ok(port > 0);
  assert.equal(url, `http://localhost:${port}`);

  const actualUrl = `http://localhost:${port}`;

  try {
    const response = await fetch(`${actualUrl}/api/teleforge/flow-hooks`, {
      body: JSON.stringify({
        input: {
          flowId: "checkout",
          routePath: "/checkout",
          screenId: "checkout.address",
          state: { userId: "u_123" },
          stepId: "address"
        },
        kind: "load"
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.kind, "load");
    assert.equal(body.result.allow, true);
    assert.equal(body.result.loaderData.heading, "Server heading");
  } finally {
    stop();
  }
});

test("startTeleforgeServer responds 501 for chatHandoff when onChatHandoff is not configured", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-start-server-handoff-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: { id: "start-server-handoff", name: "Start Server Handoff", version: "1.0.0" },
  flows: { root: "apps/bot/src/flows" },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "server_bot",
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
    path.join(flowsRoot, "checkout.flow.mjs"),
    `import { defineFlow } from ${JSON.stringify(distIndexUrl)};
export default defineFlow({
  id: "checkout",
  initialStep: "address",
  state: {},
  miniApp: { route: "/checkout" },
  steps: {
    address: { screen: "checkout.address", type: "miniapp" }
  }
});
`
  );

  const { port, stop } = await startTeleforgeServer({
    cwd: tmpRoot,
    port: 0
  });

  try {
    const response = await fetch(`http://localhost:${port}/api/teleforge/flow-hooks`, {
      body: JSON.stringify({
        input: {
          flowContext: "test-context",
          state: {},
          stateKey: "instance:test",
          stepId: "address"
        },
        kind: "chatHandoff"
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });

    assert.equal(response.status, 501);
    const text = await response.text();
    assert.match(text, /chat handoff handler configured/);
  } finally {
    stop();
  }
});

test("startTeleforgeServer uses runtime.server.port from config when no explicit port is given", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-start-server-config-port-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: { id: "config-port", name: "Config Port", version: "1.0.0" },
  flows: { root: "apps/bot/src/flows" },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "port_bot",
    webhook: { path: "/api/webhook", secretEnv: "WEBHOOK_SECRET" }
  },
  miniApp: {
    capabilities: ["read_access"],
    defaultMode: "inline",
    entry: "apps/web/src/main.tsx",
    launchModes: ["inline", "compact", "fullscreen"]
  },
  runtime: { server: { port: 17171 } }
});
`
  );
  await writeFile(
    path.join(flowsRoot, "checkout.flow.mjs"),
    `import { defineFlow } from ${JSON.stringify(distIndexUrl)};
export default defineFlow({
  id: "checkout",
  initialStep: "address",
  state: {},
  miniApp: { route: "/checkout" },
  steps: {
    address: { screen: "checkout.address", type: "miniapp" }
  }
});
`
  );

  const { port, stop, url } = await startTeleforgeServer({ cwd: tmpRoot });

  try {
    assert.equal(port, 17171);
    assert.equal(url, "http://localhost:17171");

    const response = await fetch(`${url}/api/teleforge/flow-hooks`, {
      body: JSON.stringify({
        input: {
          flowId: "checkout",
          routePath: "/checkout",
          screenId: "checkout.address",
          state: {},
          stepId: "address"
        },
        kind: "load"
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.kind, "load");
    assert.equal(body.result.allow, true);
  } finally {
    stop();
  }
});

/* ───────────────── additionalRoutes + webhook path matching ───────────────── */

test("startTeleforgeServer mounts additionalRoutes and matches exact pathname", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-webhook-route-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const hooksRoot = path.join(tmpRoot, "apps", "api", "src", "flow-hooks", "checkout");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await mkdir(hooksRoot, { recursive: true });
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: { id: "webhook-route-app", name: "Webhook Route App", version: "1.0.0" },
  flows: { root: "apps/bot/src/flows" },
  bot: { tokenEnv: "BOT_TOKEN", username: "webhook_route_bot", webhook: { path: "/api/webhook", secretEnv: "WEBHOOK_SECRET" } },
  miniApp: { capabilities: ["read_access"], defaultMode: "inline", entry: "apps/web/src/main.tsx", launchModes: ["inline"] },
  runtime: {}
});
`
  );
  await writeFile(
    path.join(flowsRoot, "main.flow.mjs"),
    `import { defineFlow } from ${JSON.stringify(distIndexUrl)};
export default defineFlow({
  id: "main", initialStep: "home", state: {},
  miniApp: { route: "/" },
  steps: { home: { screen: "home", type: "miniapp" } }
});
`
  );
  await writeFile(path.join(hooksRoot, "address.mjs"), `export const loader = () => ({});`);

  const handled = [];
  const webhookHandler = createTeleforgeWebhookHandler(
    { handle(update) { handled.push(update); } },
    { secretToken: "wh-secret" }
  );

  const { port, stop } = await startTeleforgeServer({
    cwd: tmpRoot,
    port: 0,
    additionalRoutes: [{ path: "/api/webhook", handler: webhookHandler }]
  });

  try {
    // Valid POST to the exact webhook path should reach the handler
    const update = { update_id: 99, message: { message_id: 1, chat: { id: 1, type: "private" }, text: "/start" } };
    const okResponse = await fetch(`http://localhost:${port}/api/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "wh-secret"
      },
      body: JSON.stringify(update)
    });

    assert.equal(okResponse.status, 200);
    const okBody = await okResponse.json();
    assert.equal(okBody.ok, true);
    assert.equal(handled.length, 1);
    assert.equal(handled[0].update_id, 99);

    // POST to /api/webhook-extra should NOT match the /api/webhook route
    const siblingResponse = await fetch(`http://localhost:${port}/api/webhook-extra`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    });
    assert.equal(siblingResponse.status, 404);
    assert.equal(handled.length, 1, "sibling path should not reach webhook handler");
  } finally {
    stop();
  }
});

test("startTeleforgeServer starts when no server hooks exist but additionalRoutes are provided", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-webhook-nohooks-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: { id: "nohooks-app", name: "No Hooks App", version: "1.0.0" },
  flows: { root: "apps/bot/src/flows" },
  bot: { tokenEnv: "BOT_TOKEN", username: "nohooks_bot", webhook: { path: "/api/webhook", secretEnv: "WEBHOOK_SECRET" } },
  miniApp: { capabilities: ["read_access"], defaultMode: "inline", entry: "apps/web/src/main.tsx", launchModes: ["inline"] },
  runtime: {}
});
`
  );
  await writeFile(
    path.join(flowsRoot, "main.flow.mjs"),
    `import { defineFlow } from ${JSON.stringify(distIndexUrl)};
export default defineFlow({
  id: "main", initialStep: "home", state: {},
  miniApp: { route: "/" },
  steps: { home: { screen: "home", type: "miniapp" } }
});
`
  );

  const handled = [];
  const webhookHandler = createTeleforgeWebhookHandler(
    { handle(update) { handled.push(update); } }
  );

  const { port, stop } = await startTeleforgeServer({
    cwd: tmpRoot,
    port: 0,
    additionalRoutes: [{ path: "/api/webhook", handler: webhookHandler }]
  });

  try {
    const update = { update_id: 7, message: { message_id: 1, chat: { id: 1, type: "private" }, text: "hi" } };
    const response = await fetch(`http://localhost:${port}/api/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(update)
    });

    assert.equal(response.status, 200);
    assert.equal(handled.length, 1);
  } finally {
    stop();
  }
});
