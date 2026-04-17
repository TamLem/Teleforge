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
  routes: [
    {
      path: "/"
    }
  ],
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
