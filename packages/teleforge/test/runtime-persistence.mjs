import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { createDiscoveredBotRuntime } from "../dist/index.js";
import { UserFlowStateManager, createFlowStorage } from "../dist/core.js";

async function createFixture(flows, options = {}) {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-runtime-persist-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const handlersRoot = path.join(tmpRoot, "apps", "bot", "src", "flow-handlers");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await mkdir(handlersRoot, { recursive: true });

  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: {
    id: "persist-app",
    name: "Persistence App",
    version: "1.0.0"
  },
  flows: {
    root: "apps/bot/src/flows"
  },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "persist_bot",
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
  runtime: {
    mode: "spa",
    webFramework: "vite"
  }
});
`
  );

  for (const [name, content] of Object.entries(flows)) {
    const fullPath = name.startsWith("flow-handlers/")
      ? path.join(handlersRoot, name.replace("flow-handlers/", ""))
      : path.join(flowsRoot, name);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content);
  }

  const storage =
    options.storage ??
    new UserFlowStateManager(
      createFlowStorage({
        backend: "memory",
        defaultTTL: options.ttl ?? 900,
        namespace: options.namespace ?? "persist-test"
      })
    );

  const runtime = await createDiscoveredBotRuntime({
    cwd: tmpRoot,
    flowSecret: "coord-secret",
    miniAppUrl: "https://example.ngrok.app",
    storage
  });

  const sent = [];
  const callbackAnswers = [];

  runtime.bindBot({
    async answerCallbackQuery(callbackQueryId, text) {
      callbackAnswers.push({ callbackQueryId, text });
      return { callback_query_id: callbackQueryId, text };
    },
    async sendMessage(chatId, text, opts = {}) {
      const msg = { chat: { id: chatId }, message_id: sent.length + 1, text };
      sent.push({ chatId, options: opts, text });
      return msg;
    }
  });

  return { callbackAnswers, runtime, sent, storage, tmpRoot };
}

test("persistence: create instance persists initial snapshot", async () => {
  const { runtime, storage, sent: _sent } = await createFixture({
    "order.flow.mjs": `import { defineFlow } from "${pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href}";

export default defineFlow({
  id: "order",
  initialStep: "welcome",
  state: { greeted: false },
  bot: {
    command: {
      command: "order",
      description: "Start order",
      text: "Order flow"
    }
  },
  miniApp: { route: "/order" },
  steps: {
    welcome: {
      actions: [{ id: "begin", label: "Begin", to: "catalog" }],
      message: "Welcome to order",
      type: "chat"
    },
    catalog: { screen: "catalog", type: "miniapp" }
  }
});
`
  });

  await runtime.handle({
    message: {
      chat: { id: 55, type: "private" },
      from: { first_name: "Test", id: 55 },
      message_id: 1,
      text: "/order"
    },
    update_id: 1
  });

  const resumed = await storage.resumeFlow("55", "order");
  assert.ok(resumed);
  assert.equal(resumed.flowId, "order");
  assert.equal(resumed.userId, "55");
  assert.equal(resumed.status, "active");
  assert.equal(resumed.revision, 1);
  assert.equal(resumed.stepId, "welcome");
  assert.deepEqual(resumed.state, { greeted: false });
});

test("persistence: transition commits next step and increments revision", async () => {
  const { runtime, storage, sent } = await createFixture({
    "order.flow.mjs": `import { defineFlow } from "${pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href}";

export default defineFlow({
  id: "order",
  initialStep: "welcome",
  state: {},
  bot: {
    command: {
      command: "order",
      description: "Start order",
      text: "Order flow"
    }
  },
  miniApp: { route: "/order" },
  steps: {
    welcome: {
      actions: [{ id: "begin", label: "Begin", to: "catalog" }],
      message: "Welcome",
      type: "chat"
    },
    catalog: { screen: "catalog", type: "miniapp" }
  }
});
`
  });

  await runtime.handle({
    message: {
      chat: { id: 55, type: "private" },
      from: { first_name: "Test", id: 55 },
      message_id: 1,
      text: "/order"
    },
    update_id: 1
  });

  const afterStart = await storage.resumeFlow("55", "order");
  assert.equal(afterStart.revision, 1);
  assert.equal(afterStart.stepId, "welcome");

  const cbData = sent[0]?.options?.reply_markup?.inline_keyboard?.[0]?.[0]?.callback_data;
  assert.ok(cbData);

  await runtime.handle({
    callback_query: {
      data: cbData,
      from: { first_name: "Test", id: 55 },
      id: "cb-begin",
      message: { chat: { id: 55, type: "private" }, message_id: 10, text: "Welcome" }
    },
    update_id: 2
  });

  const afterTransition = await storage.resumeFlow("55", "order");
  assert.ok(afterTransition);
  assert.ok(afterTransition.revision > 1);
  assert.equal(afterTransition.stepId, "catalog");
});

test("persistence: state commit is additive across transitions", async () => {
  const { runtime, storage, sent } = await createFixture(
    {
      "order.flow.mjs": `import { defineFlow } from "${pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href}";

export default defineFlow({
  id: "order",
  initialStep: "welcome",
  state: { items: [] },
  bot: {
    command: {
      command: "order",
      description: "Start order",
      text: "Order flow"
    }
  },
  miniApp: { route: "/order" },
  steps: {
    welcome: {
      actions: [{ id: "begin", label: "Begin", to: "review" }],
      message: "Welcome",
      type: "chat"
    },
    review: {
      message: ({ state }) => "Review: " + JSON.stringify(state.items),
      type: "chat"
    }
  }
});
`,
      "flow-handlers/order/welcome.mjs": `export const actions = {
  begin({ state }) {
    return { state: { ...state, items: ["item-1"] }, to: "review" };
  }
};
`
    },
    { namespace: "additive-test" }
  );

  await runtime.handle({
    message: {
      chat: { id: 60, type: "private" },
      from: { first_name: "Test", id: 60 },
      message_id: 1,
      text: "/order"
    },
    update_id: 1
  });

  const cbData = sent[0]?.options?.reply_markup?.inline_keyboard?.[0]?.[0]?.callback_data;
  assert.ok(cbData);

  await runtime.handle({
    callback_query: {
      data: cbData,
      from: { first_name: "Test", id: 60 },
      id: "cb-begin",
      message: { chat: { id: 60, type: "private" }, message_id: 10, text: "Welcome" }
    },
    update_id: 2
  });

  const state = await storage.resumeFlow("60", "order");
  assert.ok(state);
  assert.deepEqual(state.state.items, ["item-1"]);
});

test("persistence: resume/cancel/complete persist correct terminal state", async () => {
  const { runtime, storage, sent: _sent2 } = await createFixture({
    "order.flow.mjs": `import { defineFlow } from "${pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href}";

export default defineFlow({
  id: "order",
  initialStep: "welcome",
  state: {},
  bot: {
    command: {
      command: "order",
      description: "Start order",
      text: "Order flow"
    }
  },
  miniApp: { route: "/order" },
  steps: {
    welcome: {
      actions: [{ id: "begin", label: "Begin", to: "done" }],
      message: "Welcome",
      type: "chat"
    },
    done: { message: "Done", type: "chat" }
  }
});
`
  });

  await runtime.handle({
    message: {
      chat: { id: 70, type: "private" },
      from: { first_name: "Test", id: 70 },
      message_id: 1,
      text: "/order"
    },
    update_id: 1
  });

  const active = await storage.resumeFlow("70", "order");
  assert.equal(active.status, "active");

  const key = active.instanceId ? storage.createInstanceKey(active.instanceId) : null;
  assert.ok(key);

  await storage.completeInstance(key);
  const completed = await storage.getInstance(key);
  assert.equal(completed.status, "completed");

  await storage.startInstance("70", "order", "welcome");
  const key2 = storage.createStateKey("70", "order");
  await storage.cancelInstance(key2);
  const cancelled = await storage.getInstance(key2);
  assert.equal(cancelled.status, "cancelled");
});
