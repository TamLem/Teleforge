import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { createDiscoveredBotRuntime } from "../dist/index.js";

test("createDiscoveredBotRuntime loads config and registers commands from discovered flows", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-runtime-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: {
    id: "runtime-app",
    name: "Runtime App",
    version: "1.0.0"
  },
  flows: {
    root: "apps/bot/src/flows"
  },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "runtime_bot",
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
  await writeFile(
    path.join(flowsRoot, "start.flow.mjs"),
    `import { defineFlow } from ${JSON.stringify(distIndexUrl)};

export default defineFlow({
  id: "start",
  initialStep: "home",
  state: {},
  bot: {
    command: {
      buttonText: "Open Runtime App",
      command: "start",
      description: "Open runtime app",
      text: "Welcome to Runtime App"
    }
  },
  miniApp: {
    route: "/"
  },
  steps: {
    home: {
      screen: "home",
      type: "miniapp"
    }
  }
});
`
  );

  const runtime = await createDiscoveredBotRuntime({
    cwd: tmpRoot,
    flowSecret: "coord-secret",
    miniAppUrl: "https://example.ngrok.app"
  });
  const sent = [];

  assert.equal(runtime.getCommands().length, 1);
  assert.equal(runtime.getCommands()[0]?.command, "start");

  runtime.bindBot({
    async sendMessage(chatId, text, options) {
      sent.push({ chatId, options, text });
      return {
        chat: {
          id: chatId
        },
        message_id: 1,
        text
      };
    }
  });

  await runtime.handle({
    message: {
      chat: {
        id: 1,
        type: "private"
      },
      from: {
        first_name: "Preview",
        id: 1
      },
      message_id: 1,
      text: "/start"
    },
    update_id: 1
  });

  assert.equal(sent[0]?.text, "Welcome to Runtime App");
  assert.equal(sent[0]?.options.reply_markup.inline_keyboard[0][0].text, "Open Runtime App");
});

test("createDiscoveredBotRuntime executes discovered chat handlers through callback actions", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-runtime-chat-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const handlersRoot = path.join(tmpRoot, "apps", "bot", "src", "flow-handlers", "support");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await mkdir(handlersRoot, { recursive: true });
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: {
    id: "runtime-chat-app",
    name: "Runtime Chat App",
    version: "1.0.0"
  },
  flows: {
    root: "apps/bot/src/flows"
  },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "runtime_bot",
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
  await writeFile(
    path.join(flowsRoot, "support.flow.mjs"),
    `import { defineFlow } from ${JSON.stringify(distIndexUrl)};

export default defineFlow({
  id: "support",
  initialStep: "welcome",
  state: {
    greeted: false,
    mode: "welcome"
  },
  bot: {
    command: {
      command: "support",
      description: "Open support flow",
      text: "Open support app"
    }
  },
  miniApp: {
    route: "/support"
  },
  steps: {
    welcome: {
      actions: [
        {
          id: "help",
          label: "Help"
        }
      ],
      message: ({ state }) => state.greeted ? "Welcome back" : "Welcome",
      type: "chat"
    },
    done: {
      message: ({ state }) => state.mode === "help" ? "Help completed" : "Done",
      type: "chat"
    }
  }
});
`
  );
  await writeFile(
    path.join(handlersRoot, "welcome.mjs"),
    `export const onEnter = ({ state }) => ({
  state: {
    ...state,
    greeted: true
  }
});

export const actions = {
  help({ state }) {
    return {
      state: {
        ...state,
        mode: "help"
      },
      to: "done"
    };
  }
};
`
  );

  const runtime = await createDiscoveredBotRuntime({
    cwd: tmpRoot,
    flowSecret: "coord-secret",
    miniAppUrl: "https://example.ngrok.app"
  });
  const sent = [];
  const callbackAnswers = [];

  runtime.bindBot({
    async answerCallbackQuery(callbackQueryId, text) {
      callbackAnswers.push({
        callbackQueryId,
        text
      });
      return {
        callback_query_id: callbackQueryId,
        text
      };
    },
    async sendMessage(chatId, text, options) {
      sent.push({ chatId, options, text });
      return {
        chat: {
          id: chatId
        },
        message_id: sent.length,
        text
      };
    }
  });

  await runtime.handle({
    message: {
      chat: {
        id: 42,
        type: "private"
      },
      from: {
        first_name: "Preview",
        id: 7
      },
      message_id: 1,
      text: "/support"
    },
    update_id: 1
  });

  assert.equal(sent[0]?.text, "Welcome back");
  assert.equal(sent[0]?.options.reply_markup.inline_keyboard[0][0].text, "Help");

  await runtime.handle({
    callback_query: {
      data: sent[0]?.options.reply_markup.inline_keyboard[0][0].callback_data,
      from: {
        first_name: "Preview",
        id: 7
      },
      id: "cb-help",
      message: {
        chat: {
          id: 42,
          type: "private"
        },
        message_id: 10,
        text: "Welcome back"
      }
    },
    update_id: 2
  });

  assert.equal(callbackAnswers[0]?.callbackQueryId, "cb-help");
  assert.equal(sent[1]?.text, "Help completed");
});

test("createDiscoveredBotRuntime transitions chat actions into Mini App steps", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-runtime-transition-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: {
    id: "runtime-transition-app",
    name: "Runtime Transition App",
    version: "1.0.0"
  },
  flows: {
    root: "apps/bot/src/flows"
  },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "runtime_bot",
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
  await writeFile(
    path.join(flowsRoot, "catalog.flow.mjs"),
    `import { defineFlow } from ${JSON.stringify(distIndexUrl)};

export default defineFlow({
  id: "catalog",
  initialStep: "welcome",
  state: {},
  bot: {
    command: {
      buttonText: "Open Catalog",
      command: "catalog",
      description: "Open catalog flow",
      text: "Continue in catalog"
    }
  },
  miniApp: {
    route: "/catalog"
  },
  steps: {
    welcome: {
      actions: [
        {
          id: "open-app",
          label: "Open app",
          to: "catalog"
        }
      ],
      message: "Choose how to continue",
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

  const runtime = await createDiscoveredBotRuntime({
    cwd: tmpRoot,
    flowSecret: "coord-secret",
    miniAppUrl: "https://example.ngrok.app"
  });
  const sent = [];

  runtime.bindBot({
    async answerCallbackQuery() {
      return {};
    },
    async sendMessage(chatId, text, options) {
      sent.push({ chatId, options, text });
      return {
        chat: {
          id: chatId
        },
        message_id: sent.length,
        text
      };
    }
  });

  await runtime.handle({
    message: {
      chat: {
        id: 77,
        type: "private"
      },
      from: {
        first_name: "Preview",
        id: 9
      },
      message_id: 1,
      text: "/catalog"
    },
    update_id: 1
  });

  assert.equal(sent[0]?.text, "Choose how to continue");
  assert.equal(sent[0]?.options.reply_markup.inline_keyboard[0][0].text, "Open app");

  await runtime.handle({
    callback_query: {
      data: sent[0]?.options.reply_markup.inline_keyboard[0][0].callback_data,
      from: {
        first_name: "Preview",
        id: 9
      },
      id: "cb-open-app",
      message: {
        chat: {
          id: 77,
          type: "private"
        },
        message_id: 11,
        text: "Choose how to continue"
      }
    },
    update_id: 2
  });

  assert.equal(sent[1]?.text, "Continue in catalog");
  assert.equal(sent[1]?.options.reply_markup.inline_keyboard[0][0].text, "Open Catalog");

  const launchedUrl = sent[1]?.options.reply_markup.inline_keyboard[0][0].web_app?.url;
  assert.ok(launchedUrl);
  assert.match(launchedUrl, /tgWebAppStartParam=/);
});

test("createDiscoveredBotRuntime resumes a Mini App handoff into the next chat step", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-runtime-handoff-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: {
    id: "runtime-handoff-app",
    name: "Runtime Handoff App",
    version: "1.0.0"
  },
  flows: {
    root: "apps/bot/src/flows"
  },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "runtime_bot",
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
  await writeFile(
    path.join(flowsRoot, "checkout.flow.mjs"),
    `import { defineFlow } from ${JSON.stringify(distIndexUrl)};

export default defineFlow({
  id: "checkout",
  initialStep: "catalog",
  state: {
    itemId: null
  },
  bot: {
    command: {
      buttonText: "Open Checkout",
      command: "checkout",
      description: "Open checkout flow",
      text: "Continue in checkout"
    }
  },
  miniApp: {
    route: "/checkout"
  },
  steps: {
    catalog: {
      screen: "checkout.catalog",
      type: "miniapp"
    },
    review: {
      message: ({ state }) => state.itemId ? "Review " + state.itemId : "Review",
      type: "chat"
    }
  }
});
`
  );

  const runtime = await createDiscoveredBotRuntime({
    cwd: tmpRoot,
    flowSecret: "coord-secret",
    miniAppUrl: "https://example.ngrok.app"
  });
  const sent = [];

  runtime.bindBot({
    async sendMessage(chatId, text, options) {
      sent.push({ chatId, options, text });
      return {
        chat: {
          id: chatId
        },
        message_id: sent.length,
        text
      };
    }
  });

  await runtime.handle({
    message: {
      chat: {
        id: 101,
        type: "private"
      },
      from: {
        first_name: "Preview",
        id: 22
      },
      message_id: 1,
      text: "/checkout"
    },
    update_id: 1
  });

  const launchedUrl = sent[0]?.options.reply_markup.inline_keyboard[0][0].web_app?.url;
  assert.ok(launchedUrl);

  const launchUrl = new URL(launchedUrl);
  const flowContext = launchUrl.searchParams.get("tgWebAppStartParam");
  assert.ok(flowContext);

  const stateKey = JSON.parse(
    Buffer.from(
      flowContext.split(".")[1].replace(/-/g, "+").replace(/_/g, "/").padEnd(
        Math.ceil(flowContext.split(".")[1].length / 4) * 4,
        "="
      ),
      "base64"
    ).toString("utf8")
  ).payload.stateKey;

  const launchDebugState = runtime.getFlowRuntimeDebugState();
  assert.equal(launchDebugState.sessions.length, 1);
  assert.equal(launchDebugState.sessions[0]?.flowId, "checkout");
  assert.ok(launchDebugState.sessions[0]?.stateKey);
  assert.equal(launchDebugState.sessions[0]?.currentStepId, "catalog");
  assert.equal(launchDebugState.sessions[0]?.currentStepType, "miniapp");
  assert.equal(launchDebugState.sessions[0]?.currentRoute, "/checkout");
  assert.equal(launchDebugState.sessions[0]?.miniApp.pendingChatHandoff, true);
  assert.equal(launchDebugState.sessions[0]?.miniApp.lastLaunchStepId, "catalog");
  assert.equal(launchDebugState.sessions[0]?.snapshotStateAvailable, true);

  await runtime.handle({
    message: {
      chat: {
        id: 101,
        type: "private"
      },
      from: {
        first_name: "Preview",
        id: 22
      },
      message_id: 2,
      web_app_data: {
        button_text: "Return to chat",
        data: JSON.stringify({
          flowContext,
          state: {
            itemId: "sku_123"
          },
          stateKey,
          stepId: "review",
          type: "teleforge_flow_handoff"
        })
      }
    },
    update_id: 2
  });

  assert.equal(sent[1]?.text, "✅ Returned to chat");
  assert.equal(sent[2]?.text, "Review sku_123");

  const resumedDebugState = runtime.getFlowRuntimeDebugState();
  assert.ok(resumedDebugState.sessions.length >= 1);
  const resumedSession = resumedDebugState.sessions.find((s) => s.currentStepId === "review") ?? resumedDebugState.sessions[resumedDebugState.sessions.length - 1];
  assert.equal(resumedSession?.currentStepId, "review");
  assert.equal(resumedSession?.currentStepType, "chat");
  assert.equal(resumedSession?.miniApp.pendingChatHandoff, false);
  assert.equal(resumedSession?.miniApp.resumedStepId, "review");
  assert.equal(resumedSession?.snapshotStateAvailable, true);
});
