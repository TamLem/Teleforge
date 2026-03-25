import test from "node:test";
import assert from "node:assert/strict";
import {
  BotRouter,
  createBotRuntime,
  createDefaultStartHandler,
  isEventPayload,
  isFormPayload,
  isOrderPayload
} from "../dist/index.js";

test("routes registered commands and passes parsed args", async () => {
  const bot = createMockBot();
  const router = new BotRouter({ bot });
  let capturedArgs = [];
  let capturedCommand = "";

  router.command("settings", async (context) => {
    capturedArgs = context.args;
    capturedCommand = context.command;
    await context.reply("updated");
  });

  await router.handle(createUpdate("/settings theme dark"));

  assert.equal(capturedCommand, "settings");
  assert.deepEqual(capturedArgs, ["theme", "dark"]);
  assert.equal(bot.sent[0]?.text, "updated");
});

test("handles start and help handlers before generic command routing", async () => {
  const bot = createMockBot();
  const router = new BotRouter({ bot });

  router.onStart(async (context) => {
    await context.reply("welcome");
  });
  router.onHelp(async (context) => {
    await context.reply("help text");
  });
  router.command("start", async (context) => {
    await context.reply("generic start");
  });

  await router.handle(createUpdate("/start demo"));
  await router.handle(createUpdate("/help"));

  assert.equal(bot.sent[0]?.text, "welcome");
  assert.equal(bot.sent[1]?.text, "help text");
});

test("replies with an unknown command message when no handler exists", async () => {
  const bot = createMockBot();
  const router = new BotRouter({ bot });

  await router.handle(createUpdate("/missing"));

  assert.equal(bot.sent[0]?.text, "Unknown command. Use /help for available commands.");
});

test("replyWithWebApp creates an inline keyboard button", async () => {
  const bot = createMockBot();
  const router = new BotRouter({ bot });

  router.command("launch", async (context) => {
    await context.replyWithWebApp("Open the app", "Launch", "https://example.com/app");
  });

  await router.handle(createUpdate("/launch"));

  assert.equal(bot.sent[0]?.text, "Open the app");
  assert.deepEqual(bot.sent[0]?.options.reply_markup.inline_keyboard, [
    [
      {
        text: "Launch",
        web_app: {
          url: "https://example.com/app"
        }
      }
    ]
  ]);
});

test("runs middleware in order and preserves shared state", async () => {
  const bot = createMockBot();
  const router = new BotRouter({ bot });
  const events = [];
  let trace;

  router.use(async (context, next) => {
    events.push("mw1-before");
    context.state.trace = ["mw1"];
    await next();
    events.push("mw1-after");
  });

  router.use(async (context, next) => {
    events.push("mw2-before");
    context.state.trace = [...context.state.trace, "mw2"];
    await next();
    events.push("mw2-after");
  });

  router.command("profile", async (context) => {
    trace = context.state.trace;
    events.push("handler");
    await context.reply("profile");
  });

  await router.handle(createUpdate("/profile"));

  assert.deepEqual(events, ["mw1-before", "mw2-before", "handler", "mw2-after", "mw1-after"]);
  assert.deepEqual(trace, ["mw1", "mw2"]);
});

test("dispatches web_app_data updates to the web app handler", async () => {
  const bot = createMockBot();
  const router = new BotRouter({ bot });
  const payloads = [];

  router.onWebApp(async (context) => {
    payloads.push({
      buttonText: context.buttonText,
      data: context.data
    });
    await context.reply(`received:${context.data}`);
  });

  await router.handle(
    createUpdate(undefined, {
      button_text: "Launch",
      data: '{"ok":true}'
    })
  );

  assert.deepEqual(payloads, [
    {
      buttonText: "Launch",
      data: '{"ok":true}'
    }
  ]);
  assert.equal(bot.sent[0]?.text, 'received:{"ok":true}');
});

test("dispatches web_app_data to the dedicated data handler with parsed payload and answer helper", async () => {
  const bot = createMockBot();
  const router = new BotRouter({ bot });
  const seen = [];

  router.onWebAppData(async (context) => {
    seen.push({
      data: context.data,
      messageId: context.messageId,
      payload: context.payload,
      timestamp: context.timestamp
    });
    await context.answer("Processed");
  });

  await router.handle(
    createUpdate(undefined, {
      button_text: "Submit",
      data: JSON.stringify({
        currency: "USD",
        items: [{ id: "sku-1", quantity: 2 }],
        total: 25,
        type: "order"
      })
    })
  );

  assert.deepEqual(seen, [
    {
      data: '{"currency":"USD","items":[{"id":"sku-1","quantity":2}],"total":25,"type":"order"}',
      messageId: 1,
      payload: {
        currency: "USD",
        items: [{ id: "sku-1", quantity: 2 }],
        total: 25,
        type: "order"
      },
      timestamp: 1710000000
    }
  ]);
  assert.equal(bot.sent[0]?.text, "✅ Processed");
  assert.equal(bot.sent[0]?.options.reply_to_message_id, 1);
});

test("defaults to acknowledgment when no web_app_data handler is registered", async () => {
  const bot = createMockBot();
  const router = new BotRouter({ bot });

  await router.handle(
    createUpdate(undefined, {
      button_text: "Submit",
      data: '{"ok":true}'
    })
  );

  assert.equal(bot.sent[0]?.text, "✅ Data received");
  assert.equal(bot.sent[0]?.options.reply_to_message_id, 1);
});

test("provides raw web_app_data when JSON parsing fails", async () => {
  const bot = createMockBot();
  const router = new BotRouter({ bot });
  let payload = "unset";

  router.onWebAppData(async (context) => {
    payload = context.payload;
    await context.reply(`raw:${context.data}`);
  });

  await router.handle(
    createUpdate(undefined, {
      button_text: "Submit",
      data: "{bad-json"
    })
  );

  assert.equal(payload, null);
  assert.equal(bot.sent[0]?.text, "raw:{bad-json");
});

test("payload type guards detect common WebApp payload shapes", () => {
  assert.equal(
    isOrderPayload({
      currency: "USD",
      items: [{ id: "sku-1", quantity: 1 }],
      total: 10,
      type: "order"
    }),
    true
  );
  assert.equal(
    isFormPayload({
      fields: {
        email: "dev@example.com"
      },
      type: "form"
    }),
    true
  );
  assert.equal(
    isEventPayload({
      data: {
        ok: true
      },
      event: "submitted",
      type: "event"
    }),
    true
  );
  assert.equal(isOrderPayload({ type: "event" }), false);
});

test("createDefaultStartHandler replies with a Mini App launch button", async () => {
  const bot = createMockBot();
  const router = new BotRouter({ bot });

  router.onStart(
    createDefaultStartHandler({
      bot: {
        commands: [],
        tokenEnv: "BOT_TOKEN",
        username: "sample_bot",
        webhook: {
          path: "/api/webhook",
          secretEnv: "WEBHOOK_SECRET"
        }
      },
      id: "sample-app",
      miniApp: {
        capabilities: [],
        defaultMode: "inline",
        entryPoint: "apps/web/src/main.tsx",
        launchModes: ["inline"],
        url: "https://miniapp.example.com"
      },
      name: "Sample App",
      routes: [{ path: "/" }],
      runtime: {
        mode: "spa",
        webFramework: "vite"
      },
      version: "1.0.0"
    })
  );

  await router.handle(createUpdate("/start"));

  assert.equal(bot.sent[0]?.text, "Welcome to Sample App!");
  assert.equal(
    bot.sent[0]?.options.reply_markup.inline_keyboard[0][0].web_app.url,
    "https://miniapp.example.com"
  );
});

test("createBotRuntime supports generated command objects and manifest metadata", async () => {
  const bot = createMockBot();
  const runtime = createBotRuntime({
    bot,
    manifest: {
      bot: {
        commands: [
          {
            command: "start",
            description: "Start the Mini App",
            handler: "commands/start"
          },
          {
            command: "profile",
            description: "Show profile",
            handler: "commands/profile"
          }
        ],
        tokenEnv: "BOT_TOKEN",
        username: "runtime_bot",
        webhook: {
          path: "/api/webhook",
          secretEnv: "WEBHOOK_SECRET"
        }
      },
      id: "runtime-app",
      miniApp: {
        capabilities: [],
        defaultMode: "inline",
        entryPoint: "apps/web/src/main.tsx",
        launchModes: ["inline"]
      },
      name: "Runtime App",
      routes: [{ path: "/" }],
      runtime: {
        mode: "spa",
        webFramework: "vite"
      },
      version: "1.0.0"
    }
  });

  runtime.registerCommands([
    {
      command: "profile",
      description: "Show profile",
      async handler() {
        return {
          text: "Profile ready"
        };
      }
    }
  ]);

  await runtime.handle(createUpdate("/start"));
  await runtime.handle(createUpdate("/profile"));

  assert.deepEqual(
    runtime.getCommands().map((command) => ({
      command: command.command,
      description: command.description
    })),
    [
      {
        command: "start",
        description: "Start the Mini App"
      },
      {
        command: "profile",
        description: "Show profile"
      }
    ]
  );
  assert.equal(bot.sent[0]?.text, "Welcome to Runtime App!");
  assert.equal(bot.sent[1]?.text, "Profile ready");
});

function createMockBot() {
  return {
    sent: [],
    async sendMessage(chatId, text, options) {
      const message = {
        chat: {
          id: chatId
        },
        message_id: this.sent.length + 1,
        options,
        text
      };
      this.sent.push(message);
      return message;
    }
  };
}

function createUpdate(text, webAppData) {
  return {
    message: {
      chat: {
        id: 1001,
        type: "private"
      },
      date: 1710000000,
      from: {
        first_name: "Dev",
        id: 42,
        username: "teleforge_dev"
      },
      message_id: 1,
      text,
      web_app_data: webAppData
    },
    update_id: 1
  };
}
