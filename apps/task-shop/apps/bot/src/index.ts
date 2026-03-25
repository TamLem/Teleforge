import "dotenv/config";
import { createBotRuntime, type TelegramUpdate } from "@teleforge/bot";

import { createStartCommand } from "./commands/start.js";
import { createTasksCommand } from "./commands/tasks.js";
import { createTaskShopFlowStateManager } from "./flowState.js";
import { createOrderCompletedHandler } from "./handlers/orderCompleted.js";
import { createPollingBot, createPreviewBot } from "./telegram.js";

const miniAppUrl = process.env.MINI_APP_URL ?? "https://example.ngrok.app";
const coordinationSecret = process.env.COORDINATION_SECRET ?? "task-shop-preview-secret";
const flowStateManager = createTaskShopFlowStateManager();

async function main() {
  const runtime = createBotRuntime();
  runtime.registerCommands([
    createStartCommand(miniAppUrl, flowStateManager, coordinationSecret),
    createTasksCommand(flowStateManager)
  ]);
  runtime.router.onWebAppData(createOrderCompletedHandler(flowStateManager));

  const token = process.env.BOT_TOKEN;

  if (!token) {
    await runPreview(runtime);
    keepProcessAlive();
    return;
  }

  const bot = createPollingBot(token);
  runtime.bindBot(bot);
  await bot.setCommands(runtime.getCommands());

  let offset: number | undefined;
  console.log("[task-shop:bot] polling Telegram for updates");

  for (;;) {
    const updates = await bot.getUpdates(offset);

    for (const update of updates) {
      offset = typeof update.update_id === "number" ? update.update_id + 1 : offset;
      await runtime.handle(update);
    }
  }
}

main().catch((error) => {
  console.error("[task-shop:bot] fatal error", error);
  process.exitCode = 1;
});

async function runPreview(runtime: ReturnType<typeof createBotRuntime>) {
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
    },
    {
      message: {
        chat: {
          id: 1,
          type: "private"
        },
        date: Math.floor(Date.now() / 1000),
        from: {
          first_name: "Preview",
          id: 1,
          username: "preview_user"
        },
        message_id: 3,
        web_app_data: {
          data: JSON.stringify({
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
          })
        }
      },
      update_id: 3
    }
  ];
}

function keepProcessAlive() {
  setInterval(() => {
    // Keep the preview process alive so `pnpm dev` continues to run alongside Vite.
  }, 60_000);
}
