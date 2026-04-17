import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import {
  createFlowCommands,
  createFlowCoordinationConfigFromFlows,
  defineFlow,
  discoverFlowFiles,
  loadTeleforgeFlows
} from "../dist/index.js";
import { handleMiniAppReturn } from "../dist/bot.js";
import { UserFlowStateManager, createFlowStorage } from "../dist/core.js";

test("discoverFlowFiles and loadTeleforgeFlows read convention-based flow modules", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-flows-"));
  const flowsRoot = path.join(tmpRoot, "app-flows");
  const nestedRoot = path.join(flowsRoot, "orders");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(nestedRoot, { recursive: true });
  await writeFile(
    path.join(nestedRoot, "checkout.flow.mjs"),
    `import { defineFlow } from ${JSON.stringify(distIndexUrl)};

export default defineFlow({
  id: "checkout",
  initialStep: "catalog",
  state: {},
  bot: {
    command: {
      command: "checkout",
      description: "Open checkout",
      text: "Continue checkout"
    }
  },
  miniApp: {
    route: "/checkout"
  },
  steps: {
    catalog: {
      type: "miniapp",
      screen: "catalog"
    },
    done: {
      type: "chat",
      message: "Done"
    }
  }
});
`
  );

  const files = await discoverFlowFiles({
    app: {
      flows: {
        root: "app-flows"
      }
    },
    cwd: tmpRoot
  });

  assert.equal(files.length, 1);
  assert.match(files[0], /checkout\.flow\.mjs$/);

  const discovered = await loadTeleforgeFlows({
    app: {
      flows: {
        root: "app-flows"
      }
    },
    cwd: tmpRoot
  });

  assert.equal(discovered.length, 1);
  assert.equal(discovered[0]?.flow.id, "checkout");
  assert.equal(discovered[0]?.flow.bot?.command?.command, "checkout");
});

test("createFlowCommands derives bot commands from flow metadata", async () => {
  const flow = defineFlow({
    id: "order",
    initialStep: "catalog",
    state: {},
    bot: {
      command: {
        buttonText: "Open Order Flow",
        command: "order",
        description: "Launch order flow",
        text: "Continue order"
      }
    },
    miniApp: {
      requestWriteAccess: true,
      returnToChat: {
        text: "Back to order chat"
      },
      route: "/order"
    },
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
      namespace: "teleforge-discovery-tests"
    })
  );
  const sent = [];
  const commands = createFlowCommands({
    flows: [flow],
    secret: "coord-secret",
    storage,
    webAppUrl: "https://example.ngrok.app"
  });

  assert.equal(commands.length, 1);
  assert.equal(commands[0]?.command, "order");

  await commands[0].handler({
    args: [],
    bot: {
      async sendMessage(chatId, text, options) {
        sent.push({ chatId, options, text });
        return {
          chat: {
            id: chatId
          },
          message_id: 22,
          options,
          text
        };
      }
    },
    chat: {
      id: 7001
    },
    command: "order",
    message: {
      chat: {
        id: 7001
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
          id: 7001
        },
        text: "/order"
      }
    },
    user: {
      first_name: "Aj",
      id: 9
    }
  });

  assert.equal(sent[0]?.text, "Continue order");
  assert.equal(sent[0]?.options.reply_markup.inline_keyboard[0][0].text, "Open Order Flow");

  const launchUrl = sent[0]?.options.reply_markup.inline_keyboard[0][0].web_app?.url;
  assert.ok(launchUrl);

  const restored = await handleMiniAppReturn(
    storage,
    new URL(launchUrl).searchParams.get("tgWebAppStartParam"),
    "coord-secret"
  );

  assert.equal(restored?.flowId, "order");
  assert.equal(restored?.stepId, "catalog");
});

test("createFlowCoordinationConfigFromFlows derives routes and bot command entrypoints", () => {
  const flow = defineFlow({
    id: "order",
    initialStep: "catalog",
    state: {},
    bot: {
      command: {
        command: "order",
        text: "Continue order"
      }
    },
    miniApp: {
      requestWriteAccess: true,
      route: "/order",
      stepRoutes: {
        done: "/order/success"
      }
    },
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

  const config = createFlowCoordinationConfigFromFlows({
    flows: [flow]
  });

  assert.equal(config.resolveFlow("order")?.defaultStep, "catalog");
  assert.equal(config.resolveRoute("/order")?.metadata.flow?.entryStep, "catalog");
  assert.equal(config.resolveRoute("/order")?.metadata.flow?.requestWriteAccess, true);
  assert.equal(config.resolveStepRoute("order", "done"), "/order/success");
  assert.equal(config.resolveRoute("/order")?.metadata.entryPoints[0]?.type, "bot_command");
});
