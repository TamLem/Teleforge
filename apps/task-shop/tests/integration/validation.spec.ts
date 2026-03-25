import assert from "node:assert/strict";
import test from "node:test";

import { validateInitDataEd25519 } from "../../../../packages/core/dist/validation/ed25519.js";

import { integrationConfig } from "./config.ts";
import { createEd25519SampleVector } from "./fixtures/initData.samples.ts";
import {
  assertMessageIncludes,
  assertQueryParam,
  assertWebAppButton
} from "./helpers/assertions.ts";
import { openMiniApp, restoreMiniApp } from "./helpers/puppeteer.ts";
import { createMockTelegramHarness } from "./helpers/telegram.ts";

test("config defaults to mock mode without live credentials", () => {
  assert.equal(integrationConfig.mode, "mock");
});

test("bot /start responds with a Mini App button", async () => {
  const harness = createMockTelegramHarness();

  await harness.sendCommand("/start");

  const [message] = harness.getMessages();
  assert.ok(message);
  assertMessageIncludes(message.text ?? "", "Continue in Mini App");
  assertWebAppButton(message, "Open Task Shop");
  const buttonUrl = message.options?.reply_markup?.inline_keyboard?.[0]?.[0]?.web_app?.url;
  assert.ok(buttonUrl);
  assertQueryParam(buttonUrl, "tgWebAppStartParam");
  assertQueryParam(buttonUrl, "tfRequestWriteAccess", "1");
  assertQueryParam(buttonUrl, "tfStayInChat", "1");
});

test("bot /tasks lists the mock task catalogue", async () => {
  const harness = createMockTelegramHarness();

  await harness.sendCommand("/tasks");

  const [message] = harness.getMessages();
  assert.ok(message);
  assertMessageIncludes(message.text ?? "", "Task Shop catalogue");
  assertMessageIncludes(message.text ?? "", "Build Mini App Scaffold");
  assertMessageIncludes(message.text ?? "", "Deploy to Production");
});

test("bot persists coordinated flow state across /start and /tasks", async () => {
  const harness = createMockTelegramHarness();

  await harness.sendCommand("/start");
  await harness.sendCommand("/tasks");

  const messages = harness.getMessages();
  const catalogue = messages.at(-1);
  assert.ok(catalogue);
  assertMessageIncludes(catalogue.text ?? "", "Resuming flow task-shop-browse");
  assertMessageIncludes(catalogue.text ?? "", "State version: 1");
});

test("bot handles coordinated Mini App return payloads end-to-end", async () => {
  const harness = createMockTelegramHarness();

  await harness.sendCommand("/start");

  const startMessage = harness.getMessages()[0];
  const buttonUrl = startMessage?.options?.reply_markup?.inline_keyboard?.[0]?.[0]?.web_app?.url;
  assert.ok(buttonUrl);
  const flowContext = new URL(buttonUrl).searchParams.get("tgWebAppStartParam");
  assert.ok(flowContext);

  await harness.sendWebAppData({
    data: {
      order: {
        currency: "Stars",
        items: [
          {
            id: "task-001",
            price: 10,
            quantity: 1,
            title: "Build Mini App Scaffold"
          }
        ],
        total: 10,
        type: "order_completed"
      }
    },
    flowContext,
    result: "completed",
    returnMessage: "Task Shop order returned to chat.",
    stateKey: decodeStateKey(flowContext),
    type: "miniapp_return"
  });

  const messages = harness.getMessages();
  const summary = messages.at(-2);
  assert.ok(summary);
  assertMessageIncludes(summary.text ?? "", "Task Shop return received");
  assertMessageIncludes(summary.text ?? "", "Flow: task-shop-browse");
  assertWebAppButton(summary, "Start New Task");
});

test("bot handles unknown commands gracefully", async () => {
  const harness = createMockTelegramHarness();

  await harness.sendCommand("/unknown");

  const [message] = harness.getMessages();
  assert.equal(message.text, "Unknown command. Use /help for available commands.");
});

test("order payload produces a summary reply", async () => {
  const harness = createMockTelegramHarness();

  await harness.sendWebAppData({
    currency: "Stars",
    items: [
      {
        id: "task-001",
        price: 10,
        quantity: 1,
        title: "Build Mini App Scaffold"
      }
    ],
    total: 10,
    type: "order_completed"
  });

  const [summary] = harness.getMessages();
  assert.ok(summary);
  assertMessageIncludes(summary.text ?? "", "Task Shop order received");
  assertMessageIncludes(summary.text ?? "", "Build Mini App Scaffold x1");
});

test("order payload completes an active stored flow", async () => {
  const harness = createMockTelegramHarness();

  await harness.sendCommand("/start");
  await harness.sendWebAppData({
    currency: "Stars",
    items: [
      {
        id: "task-001",
        price: 10,
        quantity: 1,
        title: "Build Mini App Scaffold"
      }
    ],
    total: 10,
    type: "order_completed"
  });

  const summary = harness.getMessages().at(-2);
  assert.ok(summary);
  assertMessageIncludes(summary.text ?? "", "Completed flow: task-shop-browse");
});

test("order payload receives acknowledgment reply", async () => {
  const harness = createMockTelegramHarness();

  await harness.sendWebAppData({
    currency: "Stars",
    items: [],
    total: 0,
    type: "order_completed"
  });

  const messages = harness.getMessages();
  assert.equal(messages.at(-1)?.text, "✅ Order confirmed");
});

test("non-order web_app_data falls back to generic acknowledgment", async () => {
  const harness = createMockTelegramHarness();

  await harness.sendWebAppData({
    type: "unknown"
  });

  const [message] = harness.getMessages();
  assert.equal(message.text, "✅ Received Mini App data");
});

test("mock Mini App session adds tasks to the cart", async () => {
  const app = await openMiniApp();
  app.addTask("task-001");
  app.addTask("task-001");

  assert.equal(app.getItems()[0]?.quantity, 2);
  assert.equal(app.getTotal(), 20);
});

test("mock Mini App session removes tasks from the cart", async () => {
  const app = await openMiniApp();
  app.addTask("task-001");
  app.addTask("task-001");
  app.removeTask("task-001");

  assert.equal(app.getItems()[0]?.quantity, 1);
});

test("cart snapshot can be restored across reloads", async () => {
  const app = await openMiniApp();
  app.addTask("task-002");
  app.addTask("task-003");

  const restored = restoreMiniApp(app.serialize());

  assert.equal(restored.getItems().length, 2);
  assert.equal(restored.getTotal(), 27);
});

test("checkout is blocked in inline mode", async () => {
  const app = await openMiniApp();
  assert.equal(app.canCheckout("inline"), false);
});

test("checkout is allowed in compact and fullscreen modes", async () => {
  const app = await openMiniApp();
  assert.equal(app.canCheckout("compact"), true);
  assert.equal(app.canCheckout("fullscreen"), true);
});

test("checkout clears the cart and stores the last order", async () => {
  const app = await openMiniApp();
  app.addTask("task-004");
  app.addTask("task-005");

  const order = app.checkout();

  assert.equal(order.total, 38);
  assert.equal(app.getItems().length, 0);
  assert.equal(app.getLastOrder()?.type, "order_completed");
});

test("Ed25519 validation accepts a valid initData vector with hex public key", async () => {
  const vector = createEd25519SampleVector();
  const result = await validateInitDataEd25519(vector.initData, vector.publicKeyHex, {
    botId: vector.botId,
    maxAge: Number.MAX_SAFE_INTEGER
  });

  assert.equal(result.valid, true);
});

test("Ed25519 validation accepts the same vector with byte public key", async () => {
  const vector = createEd25519SampleVector();
  const result = await validateInitDataEd25519(vector.initData, vector.publicKeyBytes, {
    botId: vector.botId,
    maxAge: Number.MAX_SAFE_INTEGER
  });

  assert.equal(result.valid, true);
});

test("Ed25519 validation rejects tampered initData", async () => {
  const vector = createEd25519SampleVector();
  const result = await validateInitDataEd25519(vector.tamperedInitData, vector.publicKeyHex, {
    botId: vector.botId,
    maxAge: Number.MAX_SAFE_INTEGER
  });

  assert.deepEqual(result, {
    error: "Invalid signature.",
    valid: false
  });
});

test("Ed25519 validation rejects expired initData", async () => {
  const vector = createEd25519SampleVector();
  const result = await validateInitDataEd25519(vector.initData, vector.publicKeyHex, {
    botId: vector.botId,
    maxAge: 60
  });

  assert.deepEqual(result, {
    error: "initData expired.",
    expired: true,
    valid: false
  });
});

test("Ed25519 validation rejects missing signature", async () => {
  const vector = createEd25519SampleVector();
  const result = await validateInitDataEd25519(
    vector.initData.replace(/&signature=[^&]+/, ""),
    vector.publicKeyHex,
    {
      botId: vector.botId
    }
  );

  assert.deepEqual(result, {
    error: "Missing signature field.",
    valid: false
  });
});

test("Ed25519 validation rejects malformed public keys", async () => {
  const vector = createEd25519SampleVector();
  const result = await validateInitDataEd25519(vector.initData, "oops", {
    botId: vector.botId
  });

  assert.deepEqual(result, {
    error: "Invalid public key encoding.",
    valid: false
  });
});

function decodeStateKey(flowContext: string): string {
  const [, payload] = flowContext.split(".");
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    payload?: {
      stateKey?: string;
    };
  };

  return parsed.payload?.stateKey ?? "";
}
