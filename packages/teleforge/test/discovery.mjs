import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import {
  createFlowRoutes,
  createFlowCommands,
  createFlowCoordinationConfigFromFlows,
  createFlowRuntimeSummaries,
  createFlowRuntimeSummary,
  defineFlow,
  discoverFlowHandlerFiles,
  discoverFlowFiles,
  loadTeleforgeFlowHandlers,
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

test("createFlowRoutes derives manifest routes from flow miniapp metadata", () => {
  const flow = defineFlow({
    id: "start",
    initialStep: "home",
    state: {},
    bot: {
      command: {
        command: "start",
        text: "Open app"
      }
    },
    miniApp: {
      component: "pages/Home",
      guards: ["auth"],
      launchModes: ["inline", "compact", "fullscreen"],
      route: "/"
    },
    steps: {
      home: {
        screen: "home",
        type: "miniapp"
      }
    }
  });
  const routes = createFlowRoutes({
    flows: [flow],
    routes: [
      {
        component: "pages/Settings",
        launchModes: ["fullscreen"],
        path: "/settings"
      }
    ]
  });

  assert.equal(routes.length, 2);
  assert.equal(routes[0]?.path, "/settings");
  assert.equal(routes[1]?.path, "/");
  assert.equal(routes[1]?.component, "pages/Home");
  assert.deepEqual(routes[1]?.guards, ["auth"]);
  assert.deepEqual(routes[1]?.launchModes, ["inline", "compact", "fullscreen"]);
  assert.equal(routes[1]?.coordination?.flow?.flowId, "start");
  assert.equal(routes[1]?.coordination?.entryPoints[0]?.type, "bot_command");
});

test("createFlowRuntimeSummary exposes step-level handler wiring", () => {
  const flow = defineFlow({
    id: "checkout",
    initialStep: "welcome",
    state: {},
    bot: {
      command: {
        command: "checkout",
        text: "Open checkout"
      }
    },
    miniApp: {
      route: "/checkout"
    },
    steps: {
      welcome: {
        actions: [
          {
            label: "Choose item",
            to: "catalog"
          },
          {
            handler({ state }) {
              return {
                state
              };
            },
            label: "Fast lane"
          }
        ],
        message: "Welcome",
        onEnter({ state }) {
          return {
            state
          };
        },
        type: "chat"
      },
      catalog: {
        onSubmit({ state }) {
          return {
            state
          };
        },
        screen: "catalog",
        type: "miniapp"
      }
    }
  });

  const summary = createFlowRuntimeSummary(flow);
  const summaries = createFlowRuntimeSummaries([flow]);

  assert.equal(summary.id, "checkout");
  assert.equal(summary.command, "checkout");
  assert.equal(summary.route, "/checkout");
  assert.equal(summary.stepCount, 2);
  assert.equal(summary.hasRuntimeHandlers, true);
  assert.equal(summary.steps[0]?.id, "welcome");
  assert.equal(summary.steps[0]?.hasOnEnter, true);
  assert.equal(summary.steps[0]?.actionCount, 2);
  assert.equal(summary.steps[0]?.actions[0]?.hasHandler, false);
  assert.equal(summary.steps[0]?.actions[1]?.hasHandler, true);
  assert.equal(summary.steps[1]?.type, "miniapp");
  assert.equal(summary.steps[1]?.screen, "catalog");
  assert.equal(summary.steps[1]?.hasOnSubmit, true);
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.id, "checkout");
});

test("discoverFlowHandlerFiles and loadTeleforgeFlowHandlers resolve convention-based step handlers", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-flow-handlers-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const handlersRoot = path.join(tmpRoot, "apps", "bot", "src", "flow-handlers", "checkout");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await mkdir(handlersRoot, { recursive: true });

  await writeFile(
    path.join(flowsRoot, "checkout.flow.mjs"),
    `import { defineFlow } from ${JSON.stringify(distIndexUrl)};

export default defineFlow({
  id: "checkout",
  initialStep: "welcome",
  state: {},
  bot: {
    command: {
      command: "checkout",
      text: "Open checkout"
    }
  },
  miniApp: {
    route: "/checkout"
  },
  steps: {
    welcome: {
      actions: [
        {
          id: "fast-lane",
          label: "Fast lane"
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
`
  );

  await writeFile(
    path.join(handlersRoot, "welcome.mjs"),
    `export const onEnter = () => ({});
export const actions = {
  "fast-lane": () => ({})
};
`
  );

  await writeFile(
    path.join(handlersRoot, "catalog.mjs"),
    `export default {
  onSubmit() {
    return {};
  }
};
`
  );

  const handlerFiles = await discoverFlowHandlerFiles({
    app: {
      flows: {
        root: "apps/bot/src/flows"
      }
    },
    cwd: tmpRoot
  });

  assert.equal(handlerFiles.length, 2);
  assert.match(handlerFiles[0], /catalog\.mjs$/);
  assert.match(handlerFiles[1], /welcome\.mjs$/);

  const handlers = await loadTeleforgeFlowHandlers({
    app: {
      flows: {
        root: "apps/bot/src/flows"
      }
    },
    cwd: tmpRoot
  });
  const flows = await loadTeleforgeFlows({
    app: {
      flows: {
        root: "apps/bot/src/flows"
      }
    },
    cwd: tmpRoot
  });
  const summary = createFlowRuntimeSummaries(flows, { handlers })[0];

  assert.equal(handlers.length, 2);
  assert.equal(handlers[0]?.flowId, "checkout");
  assert.equal(summary?.hasRuntimeHandlers, true);
  assert.equal(summary?.steps[0]?.hasDiscoveredModule, true);
  assert.equal(summary?.steps[0]?.resolvedOnEnter, true);
  assert.deepEqual(summary?.steps[0]?.discoveredActionHandlerIds, ["fast-lane"]);
  assert.equal(summary?.steps[0]?.actions[0]?.handlerSource, "module");
  assert.equal(summary?.steps[1]?.hasDiscoveredModule, true);
  assert.equal(summary?.steps[1]?.resolvedOnSubmit, true);
});
