import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import {
  UserFlowStateManager,
  createDiscoveredBotRuntime,
  createFlowStorage
} from "../dist/index.js";

async function createFixture(flows, options = {}) {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-cross-surface-"));
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
    id: "cross-surface-app",
    name: "Cross Surface App",
    version: "1.0.0"
  },
  flows: {
    root: "apps/bot/src/flows"
  },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "cross_surface_bot",
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
  }
});
`
  );

  for (const [name, content] of Object.entries(flows)) {
    await writeFile(path.join(flowsRoot, name), content);
  }

  const storage =
    options.storage ??
    new UserFlowStateManager(
      createFlowStorage({
        backend: "memory",
        defaultTTL: options.ttl ?? 900,
        namespace: options.namespace ?? "cross-surface-test"
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

test("cross-surface: chat to miniapp launch loads same instance state", async () => {
  const { runtime, storage, sent } = await createFixture({
    "shop.flow.mjs": `import { defineFlow } from "${pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href}";

export default defineFlow({
  id: "shop",
  initialStep: "welcome",
  state: { cart: [] },
  bot: {
    command: {
      buttonText: "Open Shop",
      command: "shop",
      description: "Start shopping",
      text: "Welcome to Shop"
    }
  },
  miniApp: { route: "/shop" },
  steps: {
    welcome: {
      actions: [{ id: "browse", label: "Browse", to: "catalog" }],
      message: "Welcome to Shop",
      type: "chat"
    },
    catalog: { screen: "catalog", type: "miniapp" }
  }
});
`
  });

  await runtime.handle({
    message: {
      chat: { id: 80, type: "private" },
      from: { first_name: "Test", id: 80 },
      message_id: 1,
      text: "/shop"
    },
    update_id: 1
  });

  const stateFromChat = await storage.resumeFlow("80", "shop");
  assert.ok(stateFromChat);
  assert.equal(stateFromChat.flowId, "shop");
  assert.equal(stateFromChat.userId, "80");
  assert.equal(stateFromChat.currentSurface, "chat");

  const cbData = sent[0]?.options?.reply_markup?.inline_keyboard?.[0]?.[0]?.callback_data;
  assert.ok(cbData);

  await runtime.handle({
    callback_query: {
      data: cbData,
      from: { first_name: "Test", id: 80 },
      id: "cb-browse",
      message: { chat: { id: 80, type: "private" }, message_id: 10, text: "Welcome to Shop" }
    },
    update_id: 2
  });

  const stateAfterTransition = await storage.resumeFlow("80", "shop");
  assert.ok(stateAfterTransition);
  assert.equal(stateAfterTransition.stepId, "catalog");
  assert.equal(stateAfterTransition.currentSurface, "chat");

  const launchedUrl = sent[1]?.options?.reply_markup?.inline_keyboard?.[0]?.[0]?.web_app?.url;
  assert.ok(launchedUrl);
  assert.match(launchedUrl, /tgWebAppStartParam=/);
});

test("cross-surface: miniapp to chat handoff commits state before chat effects", async () => {
  const { runtime, storage, sent } = await createFixture({
    "checkout.flow.mjs": `import { defineFlow } from "${pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href}";

export default defineFlow({
  id: "checkout",
  initialStep: "catalog",
  state: { itemId: null },
  bot: {
    command: {
      buttonText: "Open Checkout",
      command: "checkout",
      description: "Open checkout",
      text: "Continue in checkout"
    }
  },
  miniApp: { route: "/checkout" },
  steps: {
    catalog: { screen: "checkout.catalog", type: "miniapp" },
    review: {
      message: ({ state }) => state.itemId ? "Review " + state.itemId : "Review",
      type: "chat"
    }
  }
});
`
  });

  await runtime.handle({
    message: {
      chat: { id: 90, type: "private" },
      from: { first_name: "Test", id: 90 },
      message_id: 1,
      text: "/checkout"
    },
    update_id: 1
  });

  const launchedUrl = sent[0]?.options?.reply_markup?.inline_keyboard?.[0]?.[0]?.web_app?.url;
  assert.ok(launchedUrl);

  const launchUrl = new URL(launchedUrl);
  const flowContext = launchUrl.searchParams.get("tgWebAppStartParam");
  assert.ok(flowContext);

  const stateKey = JSON.parse(
    Buffer.from(
      flowContext
        .split(".")[1]
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(flowContext.split(".")[1].length / 4) * 4, "="),
      "base64"
    ).toString("utf8")
  ).payload.stateKey;

  const stateBeforeHandoff = await storage.getInstance(stateKey);
  assert.ok(stateBeforeHandoff);
  assert.equal(stateBeforeHandoff.stepId, "catalog");

  await runtime.handle({
    message: {
      chat: { id: 90, type: "private" },
      from: { first_name: "Test", id: 90 },
      message_id: 2,
      web_app_data: {
        button_text: "Return to chat",
        data: JSON.stringify({
          flowContext,
          state: { itemId: "sku_123" },
          stateKey,
          stepId: "review",
          type: "teleforge_flow_handoff"
        })
      }
    },
    update_id: 2
  });

  const stateAfterHandoff = await storage.getInstance(stateKey);
  assert.ok(stateAfterHandoff);
  assert.equal(stateAfterHandoff.stepId, "review");
  assert.deepEqual(stateAfterHandoff.state, { itemId: "sku_123" });

  assert.equal(sent[1]?.text, "✅ Returned to chat");
  assert.equal(sent[2]?.text, "Review sku_123");
});

test("cross-surface: duplicate miniapp submit does not double-advance", async () => {
  const { runtime, storage, sent } = await createFixture({
    "checkout.flow.mjs": `import { defineFlow } from "${pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href}";

export default defineFlow({
  id: "checkout",
  initialStep: "catalog",
  state: { itemId: null, submitCount: 0 },
  bot: {
    command: {
      buttonText: "Open Checkout",
      command: "checkout",
      description: "Open checkout",
      text: "Continue in checkout"
    }
  },
  miniApp: { route: "/checkout" },
  steps: {
    catalog: { screen: "checkout.catalog", type: "miniapp" },
    review: {
      message: ({ state }) => "Review " + state.itemId + " (submits: " + state.submitCount + ")",
      type: "chat"
    }
  }
});
`
  });

  await runtime.handle({
    message: {
      chat: { id: 95, type: "private" },
      from: { first_name: "Test", id: 95 },
      message_id: 1,
      text: "/checkout"
    },
    update_id: 1
  });

  const launchedUrl = sent[0]?.options?.reply_markup?.inline_keyboard?.[0]?.[0]?.web_app?.url;
  const launchUrl = new URL(launchedUrl);
  const flowContext = launchUrl.searchParams.get("tgWebAppStartParam");
  const stateKey = JSON.parse(
    Buffer.from(
      flowContext
        .split(".")[1]
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(flowContext.split(".")[1].length / 4) * 4, "="),
      "base64"
    ).toString("utf8")
  ).payload.stateKey;

  const handoffPayload = JSON.stringify({
    flowContext,
    state: { itemId: "sku_123", submitCount: 1 },
    stateKey,
    stepId: "review",
    type: "teleforge_flow_handoff"
  });

  await runtime.handle({
    message: {
      chat: { id: 95, type: "private" },
      from: { first_name: "Test", id: 95 },
      message_id: 2,
      web_app_data: { button_text: "Return to chat", data: handoffPayload }
    },
    update_id: 2
  });

  const stateAfterFirst = await storage.getInstance(stateKey);
  assert.ok(stateAfterFirst);
  assert.equal(stateAfterFirst.stepId, "review");
  assert.equal(stateAfterFirst.state.submitCount, 1);

  const _sentBeforeDuplicate = sent.length;

  await runtime.handle({
    message: {
      chat: { id: 95, type: "private" },
      from: { first_name: "Test", id: 95 },
      message_id: 3,
      web_app_data: { button_text: "Return to chat", data: handoffPayload }
    },
    update_id: 3
  });

  const stateAfterDuplicate = await storage.getInstance(stateKey);
  assert.ok(stateAfterDuplicate);
  assert.equal(stateAfterDuplicate.stepId, "review");
  assert.equal(stateAfterDuplicate.state.submitCount, 1);
});

test("cross-surface: recovery after restart still loads committed state", async () => {
  const sharedStorage = new UserFlowStateManager(
    createFlowStorage({
      backend: "memory",
      defaultTTL: 900,
      namespace: "recovery-test"
    })
  );

  const fixture1 = await createFixture(
    {
      "shop.flow.mjs": `import { defineFlow } from "${pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href}";

export default defineFlow({
  id: "shop",
  initialStep: "welcome",
  state: { cart: [] },
  bot: {
    command: {
      command: "shop",
      description: "Start shopping",
      text: "Welcome to Shop"
    }
  },
  miniApp: { route: "/shop" },
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
    },
    { namespace: "recovery-test", storage: sharedStorage }
  );

  await fixture1.runtime.handle({
    message: {
      chat: { id: 100, type: "private" },
      from: { first_name: "Test", id: 100 },
      message_id: 1,
      text: "/shop"
    },
    update_id: 1
  });

  const cbData = fixture1.sent[0]?.options?.reply_markup?.inline_keyboard?.[0]?.[0]?.callback_data;
  assert.ok(cbData);

  await fixture1.runtime.handle({
    callback_query: {
      data: cbData,
      from: { first_name: "Test", id: 100 },
      id: "cb-begin",
      message: { chat: { id: 100, type: "private" }, message_id: 10, text: "Welcome" }
    },
    update_id: 2
  });

  const stateBeforeRestart = await sharedStorage.resumeFlow("100", "shop");
  assert.ok(stateBeforeRestart);
  assert.equal(stateBeforeRestart.stepId, "catalog");

  const _fixture2 = await createFixture(
    {
      "shop.flow.mjs": `import { defineFlow } from "${pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href}";

export default defineFlow({
  id: "shop",
  initialStep: "welcome",
  state: { cart: [] },
  bot: {
    command: {
      command: "shop",
      description: "Start shopping",
      text: "Welcome to Shop"
    }
  },
  miniApp: { route: "/shop" },
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
    },
    { namespace: "recovery-test", storage: sharedStorage }
  );

  const stateAfterRestart = await sharedStorage.resumeFlow("100", "shop");
  assert.ok(stateAfterRestart);
  assert.equal(stateAfterRestart.stepId, "catalog");
  assert.equal(stateAfterRestart.status, "active");
});
