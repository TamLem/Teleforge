import assert from "node:assert/strict";
import test from "node:test";

import { validateInitDataEd25519 } from "../../../../packages/core/dist/validation/ed25519.js";
import {
  executeMiniAppStepAction,
  executeMiniAppStepSubmit,
  resolveMiniAppScreen
} from "../../../../packages/teleforge/dist/index.js";
import { createOrderFromCart } from "../../packages/types/src/index.ts";
import shopCatalogueFlow from "../../apps/bot/src/flows/shop-catalogue.flow.ts";
import taskShopBrowseFlow from "../../apps/bot/src/flows/task-shop-browse.flow.ts";
import cartScreen from "../../apps/web/src/screens/cart.screen.tsx";
import catalogScreen from "../../apps/web/src/screens/catalog.screen.tsx";
import checkoutScreen from "../../apps/web/src/screens/checkout.screen.tsx";
import shopCheckoutScreen from "../../apps/web/src/screens/shop-checkout.screen.tsx";
import successScreen from "../../apps/web/src/screens/success.screen.tsx";

import { integrationConfig } from "./config.ts";
import { createEd25519SampleVector } from "./fixtures/initData.samples.ts";
import {
  assertMessageIncludes,
  assertQueryParam,
  assertWebAppButton
} from "./helpers/assertions.ts";
import { createMockTelegramHarness } from "./helpers/telegram.ts";

test("config defaults to mock mode without live credentials", () => {
  assert.equal(integrationConfig.mode, "mock");
});

test("bot /start responds with a Mini App button", async () => {
  const harness = await createMockTelegramHarness();

  await harness.sendCommand("/start");

  const [message] = harness.getMessages();
  assert.ok(message);
  assertMessageIncludes(message.text ?? "", "Welcome to Task Shop");
  assertWebAppButton(message, "Open Task Shop");
  const buttonUrl = message.options?.reply_markup?.inline_keyboard?.[0]?.[0]?.web_app?.url;
  assert.ok(buttonUrl);
  assertQueryParam(buttonUrl, "tgWebAppStartParam");
  assertQueryParam(buttonUrl, "tfRequestWriteAccess", "1");
  assertQueryParam(buttonUrl, "tfStayInChat", "1");
});

test("bot /shop lists catalogue with web_app deep-link buttons", async () => {
  const harness = await createMockTelegramHarness();

  await harness.sendCommand("/shop");

  const messages = harness.getMessages();
  assert.ok(messages.length >= 1);
  assertMessageIncludes(messages[0].text ?? "", "Select an item");

  const keyboard = messages[0].options?.reply_markup?.inline_keyboard;
  assert.ok(keyboard);
  assert.equal(keyboard.length, 6);

  for (const row of keyboard) {
    const button = row[0];
    assert.ok(button.web_app?.url, "Expected a web_app deep-link button.");
    assertQueryParam(button.web_app.url, "tgWebAppStartParam");

    const startParam = new URL(button.web_app.url).searchParams.get("tgWebAppStartParam")!;
    const [, payload] = startParam.split(".");
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    assert.equal(parsed.flowId, "shop-catalogue");
    assert.equal(parsed.stepId, "checkout");
    assert.equal(parsed.payload.route, "/shop/checkout");
    assert.ok(parsed.payload.selectedItem, "Expected selectedItem in the signed payload.");
    assert.ok(parsed.payload.stateKey, "Expected stateKey in the signed payload.");
  }
});

test("bot handles Teleforge Mini App chat handoff payloads", async () => {
  const harness = await createMockTelegramHarness();

  await harness.sendCommand("/start");

  const startMessage = harness.getMessages()[0];
  const buttonUrl = startMessage?.options?.reply_markup?.inline_keyboard?.[0]?.[0]?.web_app?.url;
  assert.ok(buttonUrl);
  const flowContext = new URL(buttonUrl).searchParams.get("tgWebAppStartParam");
  assert.ok(flowContext);

  await harness.sendWebAppData({
    flowContext,
    state: {
      cart: [],
      lastOrder: {
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
    stateKey: decodeStateKey(flowContext),
    stepId: "completed",
    type: "teleforge_flow_handoff"
  });

  const summary = harness.getMessages().at(-1);
  assert.ok(summary);
  assertMessageIncludes(summary.text ?? "", "Task Shop order confirmed.");
  assertMessageIncludes(summary.text ?? "", "Total: 10 Stars");
});

test("bot handles unknown commands gracefully", async () => {
  const harness = await createMockTelegramHarness();

  await harness.sendCommand("/unknown");

  const [message] = harness.getMessages();
  assert.equal(message.text, "Unknown command. Use /help for available commands.");
});

test("non-handoff web_app_data falls back to generic acknowledgment", async () => {
  const harness = await createMockTelegramHarness();

  await harness.sendWebAppData({
    type: "unknown"
  });

  const [message] = harness.getMessages();
  assert.equal(message.text, "✅ Received Mini App data");
});

test("Task Shop Mini App flow advances through catalog, cart, checkout, success, and chat handoff", async () => {
  const screens = [catalogScreen, cartScreen, checkoutScreen, successScreen];

  const addResult = await executeMiniAppStepSubmit({
    data: {
      taskId: "task-001",
      type: "add-item"
    },
    resolution: resolveTaskShopScreen("/", screens)
  });

  assert.equal(addResult.target, "miniapp");
  assert.equal(addResult.stepId, "catalog");
  assert.equal(addResult.routePath, "/");
  assert.equal(addResult.state.cart[0]?.quantity, 1);

  const cartResult = await executeMiniAppStepSubmit({
    data: {
      type: "go-to-cart"
    },
    resolution: resolveTaskShopScreen("/", screens, addResult.state)
  });

  assert.equal(cartResult.target, "miniapp");
  assert.equal(cartResult.stepId, "cart");
  assert.equal(cartResult.routePath, "/cart");

  const checkoutResult = await executeMiniAppStepSubmit({
    data: {
      type: "go-to-checkout"
    },
    resolution: resolveTaskShopScreen("/cart", screens, cartResult.state)
  });

  assert.equal(checkoutResult.target, "miniapp");
  assert.equal(checkoutResult.stepId, "checkout");
  assert.equal(checkoutResult.routePath, "/checkout");

  const successResult = await executeMiniAppStepSubmit({
    data: {
      type: "complete-order"
    },
    resolution: resolveTaskShopScreen("/checkout", screens, checkoutResult.state)
  });

  assert.equal(successResult.target, "miniapp");
  assert.equal(successResult.stepId, "success");
  assert.equal(successResult.routePath, "/success");
  assert.deepEqual(successResult.state.lastOrder, createOrderFromCart(checkoutResult.state.cart));

  const chatResult = await executeMiniAppStepAction({
    action: "return-to-chat",
    resolution: resolveTaskShopScreen("/success", screens, successResult.state)
  });

  assert.equal(chatResult.target, "chat");
  assert.equal(chatResult.stepId, "completed");
  assert.deepEqual(chatResult.state.lastOrder, successResult.state.lastOrder);
});

test("Task Shop Mini App success step can reset back to a fresh catalog", async () => {
  const screens = [catalogScreen, cartScreen, checkoutScreen, successScreen];
  const orderState = {
    cart: [],
    lastOrder: createOrderFromCart([
      {
        category: "Setup",
        description: "Create a new Telegram Mini App workspace with the Teleforge CLI.",
        difficulty: "Beginner",
        estimatedTime: "15 min",
        id: "task-001",
        price: 10,
        quantity: 2,
        title: "Build Mini App Scaffold"
      }
    ]),
    selectedTaskId: null
  };

  const result = await executeMiniAppStepSubmit({
    data: {
      type: "start-over"
    },
    resolution: resolveTaskShopScreen("/success", screens, orderState)
  });

  assert.equal(result.target, "miniapp");
  assert.equal(result.stepId, "catalog");
  assert.equal(result.routePath, "/");
  assert.deepEqual(result.state, {
    cart: [],
    lastOrder: null,
    selectedTaskId: null
  });
});

test("shop-catalogue Mini App checkout submits to a chat handoff with order state", async () => {
  const resolution = resolveMiniAppScreen({
    flows: [shopCatalogueFlow],
    pathname: "/shop/checkout",
    screens: [shopCheckoutScreen]
  });

  assert.ok(!("reason" in resolution));
  assert.equal(resolution.screenId, "shop.checkout");

  const result = await executeMiniAppStepSubmit({
    data: { type: "complete-order" },
    resolution: {
      ...resolution,
      state: {
        ...resolution.state,
        selectedItem: "task-001"
      }
    }
  });

  assert.equal(result.target, "chat");
  assert.equal(result.stepId, "confirmed");
  assert.ok(result.state.orderId, "Expected an order ID in the state.");
  assert.equal(result.state.selectedItem, "task-001");
});

test("shop-catalogue chat handoff sends confirmation message with tracking button", async () => {
  const harness = await createMockTelegramHarness();

  await harness.sendCommand("/shop");

  const shopMessage = harness.getMessages()[0];
  const buttonUrl = shopMessage?.options?.reply_markup?.inline_keyboard?.[0]?.[0]?.web_app?.url;
  assert.ok(buttonUrl);
  const flowContext = new URL(buttonUrl).searchParams.get("tgWebAppStartParam");
  assert.ok(flowContext);

  await harness.sendWebAppData({
    flowContext,
    state: {
      orderId: "ORD-TEST123",
      selectedItem: "task-001"
    },
    stateKey: decodeStateKey(flowContext),
    stepId: "confirmed",
    type: "teleforge_flow_handoff"
  });

  const confirmation = harness.getMessages().at(-1);
  assert.ok(confirmation);
  assertMessageIncludes(confirmation.text ?? "", "Order confirmed!");
  assertMessageIncludes(confirmation.text ?? "", "ORD-TEST123");

  const keyboard = confirmation.options?.reply_markup?.inline_keyboard;
  assert.ok(keyboard, "Expected a Track Order button.");
  assert.equal(keyboard.length, 1);
  assert.equal(keyboard[0][0].text, "Track Order");
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

function resolveTaskShopScreen(
  pathname: string,
  screens: unknown[],
  state = taskShopBrowseFlow.state
) {
  const resolution = resolveMiniAppScreen({
    flows: [taskShopBrowseFlow],
    pathname,
    screens
  });

  assert.ok(!("reason" in resolution));

  return {
    ...resolution,
    state
  };
}
