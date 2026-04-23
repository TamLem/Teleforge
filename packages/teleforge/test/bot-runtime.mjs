import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { createDiscoveredBotRuntime, startTeleforgeBot } from "../dist/index.js";
import { verifySignedPhoneAuthToken } from "@teleforgex/core";

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

test("createDiscoveredBotRuntime handles requestPhoneAction contact sharing", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-runtime-phone-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: {
    id: "runtime-phone-app",
    name: "Runtime Phone App",
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
  }
});
`
  );
  await writeFile(
    path.join(flowsRoot, "phone.flow.mjs"),
    `import { chatStep, defineFlow, requestPhoneAction } from ${JSON.stringify(distIndexUrl)};

export default defineFlow({
  id: "phone",
  initialStep: "ask",
  state: {},
  bot: {
    command: {
      command: "phone",
      description: "Share phone",
      text: "Share phone"
    }
  },
  steps: {
    ask: chatStep("Share your phone number.", [
      requestPhoneAction("Share phone", "done", {
        rawStateField: "rawPhone",
        stateField: "phone"
      })
    ]),
    done: chatStep(({ state }) => "Saved " + state.phone + " from " + state.rawPhone)
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
        id: 42,
        type: "private"
      },
      from: {
        first_name: "Preview",
        id: 7
      },
      message_id: 1,
      text: "/phone"
    },
    update_id: 1
  });

  assert.equal(sent[0]?.text, "Share your phone number.");
  assert.equal(sent[0]?.options.reply_markup.keyboard[0][0].request_contact, true);
  assert.equal(sent[0]?.options.reply_markup.keyboard[0][0].text, "Share phone");

  await runtime.handle({
    message: {
      chat: {
        id: 42,
        type: "private"
      },
      contact: {
        first_name: "Preview",
        phone_number: "+1 (202) 555-0199",
        user_id: 7
      },
      from: {
        first_name: "Preview",
        id: 7
      },
      message_id: 2
    },
    update_id: 2
  });

  assert.equal(sent[1]?.text, "Saved +12025550199 from +1 (202) 555-0199");
});

test("createDiscoveredBotRuntime unifies phone share into Mini App phone-auth launch", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-runtime-phone-auth-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: {
    id: "runtime-phone-auth-app",
    name: "Runtime Phone Auth App",
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
  }
});
`
  );
  await writeFile(
    path.join(flowsRoot, "phone-auth.flow.mjs"),
    `import {
  chatStep,
  defineFlow,
  miniAppStep,
  requestPhoneAuthAction
} from ${JSON.stringify(distIndexUrl)};

export default defineFlow({
  id: "phone-auth",
  initialStep: "ask",
  state: {},
  bot: {
    command: {
      buttonText: "Open profile",
      command: "phoneauth",
      description: "Phone auth",
      text: "Continue in profile"
    }
  },
  miniApp: {
    route: "/profile"
  },
  steps: {
    ask: chatStep("Share your phone number to continue.", [
      requestPhoneAuthAction("Share phone", "profile", {
        rawStateField: "rawPhone",
        stateField: "phone"
      })
    ]),
    profile: miniAppStep("profile")
  }
});
`
  );

  const runtime = await createDiscoveredBotRuntime({
    cwd: tmpRoot,
    flowSecret: "coord-secret",
    miniAppUrl: "https://example.ngrok.app",
    phoneAuthSecret: "phone-auth-secret"
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
        id: 51,
        type: "private"
      },
      from: {
        first_name: "Preview",
        id: 17
      },
      message_id: 1,
      text: "/phoneauth"
    },
    update_id: 1
  });

  assert.equal(sent[0]?.options.reply_markup.keyboard[0][0].request_contact, true);

  await runtime.handle({
    message: {
      chat: {
        id: 51,
        type: "private"
      },
      contact: {
        first_name: "Preview",
        phone_number: "+251 91 234 5678",
        user_id: 17
      },
      from: {
        first_name: "Preview",
        id: 17
      },
      message_id: 2
    },
    update_id: 2
  });

  assert.equal(sent[1]?.text, "Continue in profile");
  const launchedUrl = sent[1]?.options.reply_markup.inline_keyboard[0][0].web_app?.url;
  assert.ok(launchedUrl);
  assert.match(launchedUrl, /tgWebAppStartParam=/);
  assert.match(launchedUrl, /tfPhoneAuth=/);
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
      flowContext
        .split(".")[1]
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(flowContext.split(".")[1].length / 4) * 4, "="),
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
  const resumedSession =
    resumedDebugState.sessions.find((s) => s.currentStepId === "review") ??
    resumedDebugState.sessions[resumedDebugState.sessions.length - 1];
  assert.equal(resumedSession?.currentStepId, "review");
  assert.equal(resumedSession?.currentStepType, "chat");
  assert.equal(resumedSession?.miniApp.pendingChatHandoff, false);
  assert.equal(resumedSession?.miniApp.resumedStepId, "review");
  assert.equal(resumedSession?.snapshotStateAvailable, true);
});

test("startTeleforgeBot runs in preview mode when BOT_TOKEN is missing", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-start-preview-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: {
    id: "start-preview-app",
    name: "Start Preview App",
    version: "1.0.0"
  },
  flows: {
    root: "apps/bot/src/flows"
  },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "start_preview_bot",
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
  await writeFile(
    path.join(flowsRoot, "start.flow.mjs"),
    `import { defineFlow } from ${JSON.stringify(distIndexUrl)};

export default defineFlow({
  id: "start",
  initialStep: "home",
  state: {},
  bot: {
    command: {
      buttonText: "Open Preview",
      command: "start",
      description: "Open preview app",
      text: "Welcome to Preview"
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

  // Ensure BOT_TOKEN is not set
  const originalToken = process.env.BOT_TOKEN;
  delete process.env.BOT_TOKEN;

  try {
    const { runtime, stop } = await startTeleforgeBot({
      cwd: tmpRoot,
      flowSecret: "preview-secret",
      miniAppUrl: "https://example.ngrok.app",
      previewStart: true
    });

    assert.ok(runtime);
    assert.ok(typeof stop === "function");
    assert.equal(runtime.getCommands().length, 1);
    assert.equal(runtime.getCommands()[0]?.command, "start");

    // Because previewStart: true, the framework seeded a synthetic /start session
    const debugState = runtime.getFlowRuntimeDebugState();
    assert.equal(debugState.sessions.length, 1);
    assert.equal(debugState.sessions[0]?.flowId, "start");
    assert.equal(debugState.sessions[0]?.currentStepId, "home");

    stop();
  } finally {
    if (originalToken !== undefined) {
      process.env.BOT_TOKEN = originalToken;
    }
  }
});

test("startTeleforgeBot accepts a custom bot instance and skips the built-in polling loop", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-start-custom-bot-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: {
    id: "start-custom-bot-app",
    name: "Start Custom Bot App",
    version: "1.0.0"
  },
  flows: {
    root: "apps/bot/src/flows"
  },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "custom_bot",
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
  await writeFile(
    path.join(flowsRoot, "custom.flow.mjs"),
    `import { defineFlow } from ${JSON.stringify(distIndexUrl)};

export default defineFlow({
  id: "custom",
  initialStep: "main",
  state: {},
  bot: {
    command: {
      buttonText: "Open Custom",
      command: "custom",
      description: "Open custom bot app",
      text: "Welcome to Custom"
    }
  },
  miniApp: {
    route: "/custom"
  },
  steps: {
    main: {
      screen: "main",
      type: "miniapp"
    }
  }
});
`
  );

  const sent = [];
  const customBot = {
    async sendMessage(chatId, text, options) {
      sent.push({ chatId, options, text });
      return {
        chat: { id: chatId },
        message_id: sent.length,
        text
      };
    },
    async setCommands(commands) {
      // custom bot setCommands stub
    }
  };

  const { runtime, stop } = await startTeleforgeBot({
    bot: customBot,
    cwd: tmpRoot,
    flowSecret: "custom-secret",
    miniAppUrl: "https://example.ngrok.app"
  });

  assert.ok(runtime);
  assert.ok(typeof stop === "function");
  assert.equal(runtime.getCommands().length, 1);
  assert.equal(runtime.getCommands()[0]?.command, "custom");

  // The caller drives updates manually
  await runtime.handle({
    message: {
      chat: { id: 1, type: "private" },
      from: { first_name: "Test", id: 1, username: "test_user" },
      message_id: 1,
      text: "/custom"
    },
    update_id: 1
  });

  assert.equal(sent[0]?.text, "Welcome to Custom");

  stop();
});

test("startTeleforgeBot fails fast in live mode when TELEFORGE_FLOW_SECRET is missing", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-start-live-no-secret-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: {
    id: "live-no-secret",
    name: "Live No Secret",
    version: "1.0.0"
  },
  flows: { root: "apps/bot/src/flows" },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "live_bot",
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
    path.join(flowsRoot, "start.flow.mjs"),
    `import { defineFlow } from ${JSON.stringify(distIndexUrl)};
export default defineFlow({
  id: "start", initialStep: "home", state: {},
  bot: { command: { command: "start", description: "Start", text: "Hi" } },
  miniApp: { route: "/" },
  steps: { home: { screen: "home", type: "miniapp" } }
});
`
  );

  const originalToken = process.env.BOT_TOKEN;
  const originalFlowSecret = process.env.TELEFORGE_FLOW_SECRET;
  const originalMiniAppUrl = process.env.MINI_APP_URL;
  process.env.BOT_TOKEN = "123456:live-token";
  delete process.env.TELEFORGE_FLOW_SECRET;
  process.env.MINI_APP_URL = "https://example.ngrok.app";

  try {
    await assert.rejects(
      () =>
        startTeleforgeBot({
          cwd: tmpRoot,
          miniAppUrl: "https://example.ngrok.app"
        }),
      /requires TELEFORGE_FLOW_SECRET/
    );
  } finally {
    if (originalToken !== undefined) process.env.BOT_TOKEN = originalToken;
    else delete process.env.BOT_TOKEN;
    if (originalFlowSecret !== undefined) process.env.TELEFORGE_FLOW_SECRET = originalFlowSecret;
    else delete process.env.TELEFORGE_FLOW_SECRET;
    if (originalMiniAppUrl !== undefined) process.env.MINI_APP_URL = originalMiniAppUrl;
    else delete process.env.MINI_APP_URL;
  }
});

test("startTeleforgeBot fails fast in live mode when MINI_APP_URL is missing", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-start-live-no-url-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: {
    id: "live-no-url",
    name: "Live No URL",
    version: "1.0.0"
  },
  flows: { root: "apps/bot/src/flows" },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "live_bot",
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
    path.join(flowsRoot, "start.flow.mjs"),
    `import { defineFlow } from ${JSON.stringify(distIndexUrl)};
export default defineFlow({
  id: "start", initialStep: "home", state: {},
  bot: { command: { command: "start", description: "Start", text: "Hi" } },
  miniApp: { route: "/" },
  steps: { home: { screen: "home", type: "miniapp" } }
});
`
  );

  const originalToken = process.env.BOT_TOKEN;
  const originalFlowSecret = process.env.TELEFORGE_FLOW_SECRET;
  const originalMiniAppUrl = process.env.MINI_APP_URL;
  process.env.BOT_TOKEN = "123456:live-token";
  process.env.TELEFORGE_FLOW_SECRET = "live-secret";
  delete process.env.MINI_APP_URL;

  try {
    await assert.rejects(
      () =>
        startTeleforgeBot({
          cwd: tmpRoot,
          flowSecret: "live-secret"
        }),
      /requires MINI_APP_URL/
    );
  } finally {
    if (originalToken !== undefined) process.env.BOT_TOKEN = originalToken;
    else delete process.env.BOT_TOKEN;
    if (originalFlowSecret !== undefined) process.env.TELEFORGE_FLOW_SECRET = originalFlowSecret;
    else delete process.env.TELEFORGE_FLOW_SECRET;
    if (originalMiniAppUrl !== undefined) process.env.MINI_APP_URL = originalMiniAppUrl;
    else delete process.env.MINI_APP_URL;
  }
});

test("startTeleforgeBot preview mode is passive by default (no synthetic session)", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-start-passive-preview-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: {
    id: "passive-preview",
    name: "Passive Preview",
    version: "1.0.0"
  },
  flows: { root: "apps/bot/src/flows" },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "passive_bot",
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
    path.join(flowsRoot, "start.flow.mjs"),
    `import { defineFlow } from ${JSON.stringify(distIndexUrl)};
export default defineFlow({
  id: "start", initialStep: "home", state: {},
  bot: { command: { command: "start", description: "Start", text: "Hi" } },
  miniApp: { route: "/" },
  steps: { home: { screen: "home", type: "miniapp" } }
});
`
  );

  const originalToken = process.env.BOT_TOKEN;
  delete process.env.BOT_TOKEN;

  try {
    const { runtime, stop } = await startTeleforgeBot({
      cwd: tmpRoot,
      flowSecret: "preview-secret",
      miniAppUrl: "https://example.ngrok.app"
    });

    assert.ok(runtime);
    assert.equal(runtime.getCommands().length, 1);

    // No previewStart option, so no synthetic session was created
    const debugState = runtime.getFlowRuntimeDebugState();
    assert.equal(debugState.sessions.length, 0);

    stop();
  } finally {
    if (originalToken !== undefined) process.env.BOT_TOKEN = originalToken;
  }
});

test("startTeleforgeBot fails fast in live mode when runtime.bot.delivery is webhook", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-start-webhook-delivery-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: { id: "webhook-delivery", name: "Webhook Delivery", version: "1.0.0" },
  flows: { root: "apps/bot/src/flows" },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "webhook_bot",
    webhook: { path: "/api/webhook", secretEnv: "WEBHOOK_SECRET" }
  },
  miniApp: {
    capabilities: ["read_access"],
    defaultMode: "inline",
    entry: "apps/web/src/main.tsx",
    launchModes: ["inline", "compact", "fullscreen"]
  },
  runtime: { bot: { delivery: "webhook" } }
});
`
  );
  await writeFile(
    path.join(flowsRoot, "start.flow.mjs"),
    `import { defineFlow } from ${JSON.stringify(distIndexUrl)};
export default defineFlow({
  id: "start", initialStep: "home", state: {},
  bot: { command: { command: "start", description: "Start", text: "Hi" } },
  miniApp: { route: "/" },
  steps: { home: { screen: "home", type: "miniapp" } }
});
`
  );

  // Set a token so the bootstrap enters live mode, which is where webhook is rejected.
  const originalToken = process.env.BOT_TOKEN;
  process.env.BOT_TOKEN = "123456:webhook-token";

  try {
    await assert.rejects(
      () => startTeleforgeBot({ cwd: tmpRoot }),
      /live mode does not yet support webhook delivery/
    );
  } finally {
    if (originalToken !== undefined) process.env.BOT_TOKEN = originalToken;
    else delete process.env.BOT_TOKEN;
  }
});

test("startTeleforgeBot allows webhook delivery in preview mode (no token)", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-start-webhook-preview-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: { id: "webhook-preview", name: "Webhook Preview", version: "1.0.0" },
  flows: { root: "apps/bot/src/flows" },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "webhook_preview_bot",
    webhook: { path: "/api/webhook", secretEnv: "WEBHOOK_SECRET" }
  },
  miniApp: {
    capabilities: ["read_access"],
    defaultMode: "inline",
    entry: "apps/web/src/main.tsx",
    launchModes: ["inline", "compact", "fullscreen"]
  },
  runtime: { bot: { delivery: "webhook" } }
});
`
  );
  await writeFile(
    path.join(flowsRoot, "start.flow.mjs"),
    `import { defineFlow } from ${JSON.stringify(distIndexUrl)};
export default defineFlow({
  id: "start", initialStep: "home", state: {},
  bot: { command: { command: "start", description: "Start", text: "Hi" } },
  miniApp: { route: "/" },
  steps: { home: { screen: "home", type: "miniapp" } }
});
`
  );

  const originalToken = process.env.BOT_TOKEN;
  delete process.env.BOT_TOKEN;

  try {
    const { runtime, stop } = await startTeleforgeBot({ cwd: tmpRoot });
    assert.ok(runtime);
    assert.equal(runtime.getCommands().length, 1);
    stop();
  } finally {
    if (originalToken !== undefined) process.env.BOT_TOKEN = originalToken;
  }
});

test("startTeleforgeBot reads phone-auth secret from runtime.phoneAuth.secretEnv", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-start-phone-auth-env-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const distIndexUrl = pathToFileURL(path.join(process.cwd(), "dist", "index.js")).href;

  await mkdir(flowsRoot, { recursive: true });
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(distIndexUrl)};

export default defineTeleforgeApp({
  app: { id: "phone-auth-env", name: "Phone Auth Env", version: "1.0.0" },
  flows: { root: "apps/bot/src/flows" },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "phone_bot",
    webhook: { path: "/api/webhook", secretEnv: "WEBHOOK_SECRET" }
  },
  miniApp: {
    capabilities: ["read_access"],
    defaultMode: "inline",
    entry: "apps/web/src/main.tsx",
    launchModes: ["inline", "compact", "fullscreen"]
  },
  runtime: { phoneAuth: { secretEnv: "CUSTOM_PHONE_SECRET" } }
});
`
  );
  await writeFile(
    path.join(flowsRoot, "phone-auth.flow.mjs"),
    `import { chatStep, defineFlow, miniAppStep, requestPhoneAuthAction } from ${JSON.stringify(distIndexUrl)};
export default defineFlow({
  id: "phone-auth",
  initialStep: "ask",
  state: {},
  bot: {
    command: {
      buttonText: "Open profile",
      command: "phoneauth",
      description: "Phone auth",
      text: "Continue in profile"
    }
  },
  miniApp: { route: "/profile" },
  steps: {
    ask: chatStep("Share your phone number to continue.", [
      requestPhoneAuthAction("Share phone", "profile", {
        rawStateField: "rawPhone",
        stateField: "phone"
      })
    ]),
    profile: miniAppStep("profile")
  }
});
`
  );

  const originalToken = process.env.BOT_TOKEN;
  const originalFlowSecret = process.env.TELEFORGE_FLOW_SECRET;
  const originalMiniAppUrl = process.env.MINI_APP_URL;
  const originalPhoneSecret = process.env.CUSTOM_PHONE_SECRET;
  process.env.BOT_TOKEN = "123456:live-token";
  process.env.TELEFORGE_FLOW_SECRET = "live-secret";
  process.env.MINI_APP_URL = "https://example.ngrok.app";
  process.env.CUSTOM_PHONE_SECRET = "custom-phone-secret";
  delete process.env.PHONE_AUTH_SECRET;

  // Use a custom bot instance to avoid real Telegram API calls during test.
  const customBot = {
    async sendMessage(chatId, text, options) {
      return { chat: { id: chatId }, message_id: 1, text };
    },
    async setCommands(commands) {
      // stub
    }
  };

  try {
    const { runtime, stop } = await startTeleforgeBot({ bot: customBot, cwd: tmpRoot });
    assert.ok(runtime);

    // Drive a /phoneauth command through the runtime to prove the phone-auth
    // secret was picked up and the runtime is functional.
    const sent = [];
    runtime.bindBot({
      async sendMessage(chatId, text, options) {
        sent.push({ chatId, options, text });
        return { chat: { id: chatId }, message_id: sent.length, text };
      }
    });

    await runtime.handle({
      message: {
        chat: { id: 42, type: "private" },
        from: { first_name: "Test", id: 7 },
        message_id: 1,
        text: "/phoneauth"
      },
      update_id: 1
    });

    assert.equal(sent[0]?.text, "Share your phone number to continue.");
    assert.equal(sent[0]?.options.reply_markup.keyboard[0][0].request_contact, true);

    // Drive the contact share completion to prove the custom secret env is used
    // for signing the phone-auth token.
    await runtime.handle({
      message: {
        chat: { id: 42, type: "private" },
        contact: {
          first_name: "Test",
          phone_number: "+251 91 234 5678",
          user_id: 7
        },
        from: { first_name: "Test", id: 7 },
        message_id: 2
      },
      update_id: 2
    });

    assert.equal(sent[1]?.text, "Continue in profile");
    const launchedUrl = sent[1]?.options.reply_markup.inline_keyboard[0][0].web_app?.url;
    assert.ok(launchedUrl);
    assert.match(launchedUrl, /tgWebAppStartParam=/);
    assert.match(launchedUrl, /tfPhoneAuth=/);

    // Prove the token was signed with the custom secret, not the flow secret.
    const phoneAuthToken = new URL(launchedUrl).searchParams.get("tfPhoneAuth");
    assert.ok(phoneAuthToken);
    const verifiedWithCustom = await verifySignedPhoneAuthToken(phoneAuthToken, "custom-phone-secret");
    assert.ok(verifiedWithCustom, "Token should verify with the custom secret from runtime.phoneAuth.secretEnv");
    const verifiedWithFlow = await verifySignedPhoneAuthToken(phoneAuthToken, "live-secret");
    assert.equal(verifiedWithFlow, null, "Token should NOT verify with the flow secret");

    stop();
  } finally {
    if (originalToken !== undefined) process.env.BOT_TOKEN = originalToken;
    else delete process.env.BOT_TOKEN;
    if (originalFlowSecret !== undefined) process.env.TELEFORGE_FLOW_SECRET = originalFlowSecret;
    else delete process.env.TELEFORGE_FLOW_SECRET;
    if (originalMiniAppUrl !== undefined) process.env.MINI_APP_URL = originalMiniAppUrl;
    else delete process.env.MINI_APP_URL;
    if (originalPhoneSecret !== undefined) process.env.CUSTOM_PHONE_SECRET = originalPhoneSecret;
    else delete process.env.CUSTOM_PHONE_SECRET;
  }
});
