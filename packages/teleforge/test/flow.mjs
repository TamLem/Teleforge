import assert from "node:assert/strict";
import test from "node:test";

import {
  UserFlowStateManager,
  createFlowStorage,
  createFlowCoordinationConfig,
  createFlowStartCommand,
  defineFlow,
  getFlowStep,
  isMiniAppStep,
  chatStep,
  miniAppStep,
  openMiniAppAction,
  returnToChatAction
} from "../dist/index.js";
import { handleMiniAppReturn } from "../dist/bot.js";

test("defineFlow normalizes the final step and validates chat action targets", () => {
  const flow = defineFlow({
    id: "order",
    initialStep: "welcome",
    state: {
      quantity: 1
    },
    steps: {
      welcome: {
        actions: [
          {
            label: "Open catalog",
            to: "catalog"
          }
        ],
        message: "Welcome",
        type: "chat"
      },
      catalog: {
        screen: "catalog",
        type: "miniapp"
      }
    }
  });

  assert.equal(flow.finalStep, "catalog");
  assert.equal(flow.initialStep, "welcome");
  assert.equal(getFlowStep(flow, "catalog").type, "miniapp");
  assert.equal(isMiniAppStep(getFlowStep(flow, "catalog")), true);
  assert.equal(isMiniAppStep(getFlowStep(flow, "welcome")), false);

  assert.throws(
    () =>
      defineFlow({
        id: "broken-flow",
        initialStep: "welcome",
        state: {},
        steps: {
          welcome: {
            actions: [
              {
                label: "Continue",
                to: "missing"
              }
            ],
            message: "Welcome",
            type: "chat"
          }
        }
      }),
    /unknown step "missing"/
  );
});

test("createFlowCoordinationConfig derives coordination metadata from a flow", () => {
  const flow = defineFlow({
    finalStep: "confirm",
    id: "order",
    initialStep: "catalog",
    onComplete: "return_to_chat",
    state: {},
    steps: {
      catalog: {
        screen: "catalog",
        type: "miniapp"
      },
      confirm: {
        message: "Confirm your order",
        type: "chat"
      }
    }
  });

  const config = createFlowCoordinationConfig({
    entryPoints: [
      {
        command: "order",
        type: "bot_command"
      }
    ],
    flow,
    requestWriteAccess: true,
    returnToChat: {
      text: "Return to chat"
    },
    route: "/app",
    stepRoutes: {
      confirm: "/app/confirm"
    }
  });

  assert.equal(config.resolveEntryPoint("command", "order"), undefined);
  assert.equal(config.resolveFlow("order")?.defaultStep, "catalog");
  assert.equal(config.resolveFlow("order")?.finalStep, "confirm");
  assert.equal(config.resolveStepRoute("order", "confirm"), "/app/confirm");
  assert.equal(config.resolveRoute("/app")?.metadata.flow?.entryStep, "catalog");
  assert.equal(config.resolveRoute("/app")?.metadata.flow?.requestWriteAccess, true);
  assert.equal(config.resolveRoute("/app")?.metadata.returnToChat?.text, "Return to chat");
});

test("createFlowStartCommand launches a persisted miniapp flow", async () => {
  const flow = defineFlow({
    id: "order",
    initialStep: "catalog",
    state: {},
    steps: {
      catalog: {
        screen: "catalog",
        type: "miniapp"
      },
      done: {
        message: "Done",
        type: "chat"
      }
    }
  });
  const storage = new UserFlowStateManager(
    createFlowStorage({
      backend: "memory",
      defaultTTL: 60,
      namespace: "teleforge-flow-tests"
    })
  );
  const sent = [];
  const command = createFlowStartCommand({
    buttonText: ({ user }) => `Open for ${user.first_name}`,
    command: "order",
    description: "Launch the order flow",
    flow,
    payload: ({ command: commandName }) => ({
      source: commandName
    }),
    secret: "coord-secret",
    storage,
    text: "Continue in the Mini App",
    webAppUrl: "https://example.ngrok.app"
  });

  await command.handler({
    args: [],
    bot: {
      async sendMessage(chatId, text, options) {
        sent.push({ chatId, options, text });
        return {
          chat: {
            id: chatId
          },
          message_id: 101,
          options,
          text
        };
      }
    },
    chat: {
      id: 1001
    },
    command: "order",
    message: {
      chat: {
        id: 1001
      },
      text: "/order"
    },
    reply: async () => {
      throw new Error("reply should not be used");
    },
    replyWithWebApp: async () => {
      throw new Error("replyWithWebApp should not be used");
    },
    state: {},
    update: {
      message: {
        chat: {
          id: 1001
        },
        text: "/order"
      }
    },
    user: {
      first_name: "Aj",
      id: 42
    }
  });

  assert.equal(sent[0]?.text, "Continue in the Mini App");
  assert.equal(sent[0]?.options.reply_markup.inline_keyboard[0][0].text, "Open for Aj");

  const launchUrl = sent[0]?.options.reply_markup.inline_keyboard[0][0].web_app?.url;
  assert.ok(launchUrl);

  const restored = await handleMiniAppReturn(
    storage,
    new URL(launchUrl).searchParams.get("tgWebAppStartParam"),
    "coord-secret"
  );

  assert.equal(restored?.flowId, "order");
  assert.equal(restored?.stepId, "catalog");
  assert.equal(restored?.state?.source, "order");
});

test("createFlowStartCommand rejects chat entry steps", () => {
  const flow = defineFlow({
    id: "order",
    initialStep: "welcome",
    state: {},
    steps: {
      welcome: {
        message: "Welcome",
        type: "chat"
      }
    }
  });
  const storage = new UserFlowStateManager(
    createFlowStorage({
      backend: "memory",
      defaultTTL: 60,
      namespace: "teleforge-flow-tests"
    })
  );

  assert.throws(
    () =>
      createFlowStartCommand({
        command: "order",
        flow,
        secret: "coord-secret",
        storage,
        text: "Open",
        webAppUrl: "https://example.ngrok.app"
      }),
    /must be a miniapp step/
  );
});

test("miniAppStep removes repetitive type and screen boilerplate", () => {
  const step = miniAppStep("checkout", {
    onSubmit: async () => ({ to: "success" })
  });

  assert.equal(step.type, "miniapp");
  assert.equal(step.screen, "checkout");
  assert.equal(typeof step.onSubmit, "function");
});

test("chatStep removes repetitive type and message boilerplate", () => {
  const step = chatStep("Welcome!", [
    openMiniAppAction("Open app", "home", { ref: "start" })
  ]);

  assert.equal(step.type, "chat");
  assert.equal(step.message, "Welcome!");
  assert.equal(step.actions?.length, 1);
  assert.equal(step.actions?.[0]?.label, "Open app");
  assert.equal(step.actions?.[0]?.to, "home");
  assert.deepEqual(step.actions?.[0]?.miniApp?.payload, { ref: "start" });
});

test("chatStep supports dynamic message functions", () => {
  const step = chatStep(({ state }) => `Hello, ${(state).name}!`);

  assert.equal(step.type, "chat");
  assert.equal(typeof step.message, "function");
  assert.equal(
    step.message({ state: { name: "Alice" } }),
    "Hello, Alice!"
  );
});

test("openMiniAppAction creates a Mini App transition action", () => {
  const action = openMiniAppAction("Track Order", "tracking", { orderId: "123" });

  assert.equal(action.label, "Track Order");
  assert.equal(action.to, "tracking");
  assert.deepEqual(action.miniApp?.payload, { orderId: "123" });
});

test("openMiniAppAction works without payload", () => {
  const action = openMiniAppAction("Open cart", "cart");

  assert.equal(action.label, "Open cart");
  assert.equal(action.to, "cart");
  assert.ok(!action.miniApp?.payload);
});

test("returnToChatAction creates a callback transition action", () => {
  const action = returnToChatAction("Return to chat", "completed");

  assert.equal(action.label, "Return to chat");
  assert.equal(action.to, "completed");
  assert.ok(!action.miniApp);
});

test("flow authoring helpers integrate with defineFlow", () => {
  const flow = defineFlow({
    id: "checkout",
    initialStep: "cart",
    state: { items: [] },
    steps: {
      cart: miniAppStep("checkout.cart", {
        actions: [returnToChatAction("Cancel", "abandoned")]
      }),
      confirm: miniAppStep("checkout.confirm", {
        onSubmit: async () => ({ to: "receipt" })
      }),
      receipt: chatStep("Order confirmed!", [
        openMiniAppAction("Track order", "track", { orderId: "abc" })
      ]),
      abandoned: chatStep("Cart abandoned. Come back anytime!"),
      track: miniAppStep("checkout.track")
    }
  });

  assert.equal(flow.id, "checkout");
  assert.equal(getFlowStep(flow, "cart").type, "miniapp");
  assert.equal(getFlowStep(flow, "cart").screen, "checkout.cart");
  assert.equal(getFlowStep(flow, "receipt").type, "chat");
  assert.equal(getFlowStep(flow, "receipt").message, "Order confirmed!");
  assert.equal(getFlowStep(flow, "track").type, "miniapp");
  assert.equal(getFlowStep(flow, "track").screen, "checkout.track");
});
