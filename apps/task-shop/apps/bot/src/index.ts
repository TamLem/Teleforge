import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";

import { createTaskShopBotRuntime, readTaskShopBotConfig } from "./runtime.js";
import { createPollingBot, createPreviewBot } from "./telegram.js";

import type { BotRuntime, TelegramUpdate } from "teleforge/bot";

loadTaskShopEnv();

const botConfig = readTaskShopBotConfig();
const pollDebug = botConfig.pollDebug;

async function main() {
  const runtime = await createTaskShopBotRuntime(botConfig);
  const token = botConfig.token;

  if (!token) {
    await runPreview(runtime);
    keepProcessAlive();
    return;
  }

  const bot = createPollingBot(token);
  runtime.bindBot(bot);
  const commands = runtime.getCommands();
  await bot.setCommands(commands);

  let offset: number | undefined;
  console.log(
    `[task-shop:bot] polling Telegram for updates (${commands.length} commands registered)`
  );

  if (pollDebug) {
    console.log(`[task-shop:bot:poll] debug logging enabled`);
    console.log(`[task-shop:bot:poll] Mini App URL: ${botConfig.miniAppUrl}`);
  }

  for (;;) {
    if (pollDebug) {
      console.log(
        `[task-shop:bot:poll] requesting updates${typeof offset === "number" ? ` from offset ${offset}` : ""}`
      );
    }

    const updates = await bot.getUpdates(offset);

    if (pollDebug) {
      console.log(
        updates.length === 0
          ? "[task-shop:bot:poll] no updates received"
          : `[task-shop:bot:poll] received ${updates.length} update(s): ${updates.map(describeUpdate).join(", ")}`
      );
    }

    for (const update of updates) {
      offset = typeof update.update_id === "number" ? update.update_id + 1 : offset;
      if (pollDebug) {
        console.log(`[task-shop:bot:poll] handling ${describeUpdate(update)}`);
      }
      await runtime.handle(update);
      if (pollDebug) {
        console.log(
          `[task-shop:bot:poll] handled update ${typeof update.update_id === "number" ? update.update_id : "unknown"}`
        );
      }
    }
  }
}

main().catch((error) => {
  console.error("[task-shop:bot] fatal error", error);
  process.exitCode = 1;
});

async function runPreview(runtime: BotRuntime) {
  const bot = createPreviewBot((message) => {
    console.log("[task-shop:bot:preview]", message);
  });

  runtime.bindBot(bot);

  console.log("[task-shop:bot] BOT_TOKEN missing, running in preview mode");

  for (const update of createPreviewUpdates()) {
    await runtime.handle(update);
  }
}

function createPreviewUpdates(): TelegramUpdate[] {
  return [
    {
      message: {
        chat: {
          id: 1,
          type: "private"
        },
        from: {
          first_name: "Preview",
          id: 1,
          username: "preview_user"
        },
        message_id: 1,
        text: "/start"
      },
      update_id: 1
    },
    {
      message: {
        chat: {
          id: 1,
          type: "private"
        },
        from: {
          first_name: "Preview",
          id: 1,
          username: "preview_user"
        },
        message_id: 2,
        text: "/tasks"
      },
      update_id: 2
    }
  ];
}

function keepProcessAlive() {
  setInterval(() => {
    // Keep the preview process alive so `pnpm dev` continues to run alongside Vite.
  }, 60_000);
}

function describeUpdate(update: TelegramUpdate): string {
  const label = typeof update.update_id === "number" ? `#${update.update_id}` : "#unknown";
  const message = update.message;

  if (!message) {
    return `${label} non-message update`;
  }

  if (typeof message.text === "string" && message.text.length > 0) {
    return `${label} command ${message.text}`;
  }

  if (message.web_app_data?.data) {
    const summary = describeWebAppData(message.web_app_data.data);
    return summary ? `${label} web_app_data ${summary}` : `${label} web_app_data`;
  }

  return `${label} message ${message.message_id}`;
}

function describeWebAppData(data: string): string | undefined {
  try {
    const parsed = JSON.parse(data) as { type?: unknown };
    return typeof parsed.type === "string" ? parsed.type : undefined;
  } catch {
    return "unparseable";
  }
}

function loadTaskShopEnv() {
  const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const envPaths = [resolve(workspaceRoot, ".env"), resolve(workspaceRoot, ".env.local")];

  for (const envPath of envPaths) {
    if (!existsSync(envPath)) {
      continue;
    }

    loadDotenv({
      override: envPath.endsWith(".env.local"),
      path: envPath
    });
  }
}
