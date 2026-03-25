import "dotenv/config";

import {
  createBotRuntime,
  type BotInstance,
  type RegisteredCommand,
  type ReplyOptions,
  type TelegramMessage,
  type TelegramUpdate
} from "@teleforge/bot";

const miniAppUrl = process.env.MINI_APP_URL ?? "https://example.ngrok.app";

async function main() {
  const runtime = createBotRuntime();
  runtime.registerCommands([
    {
      command: "start",
      description: "Open the Starter App",
      async handler(context) {
        await context.replyWithWebApp(
          "Starter App is ready. Open the Mini App to inspect Telegram theme, user data, and MainButton behavior.",
          "Open Starter App",
          miniAppUrl
        );
      }
    }
  ]);

  const token = process.env.BOT_TOKEN;
  if (!hasRealToken(token)) {
    await runPreview(runtime);
    keepProcessAlive();
    return;
  }

  const bot = createPollingBot(token);
  runtime.bindBot(bot);
  await bot.setCommands(runtime.getCommands());

  let offset: number | undefined;
  console.log("[starter-app:bot] polling Telegram for updates");

  for (;;) {
    const updates = await bot.getUpdates(offset);

    for (const update of updates) {
      offset = typeof update.update_id === "number" ? update.update_id + 1 : offset;
      await runtime.handle(update);
    }
  }
}

main().catch((error) => {
  console.error("[starter-app:bot] fatal error", error);
  process.exitCode = 1;
});

async function runPreview(runtime: ReturnType<typeof createBotRuntime>) {
  runtime.bindBot({
    async sendMessage(chatId, text, options) {
      const payload = {
        chatId,
        options,
        text
      };
      console.log("[starter-app:bot:preview]", JSON.stringify(payload));
      return {
        chat: {
          id: chatId,
          type: "private"
        },
        message_id: Date.now(),
        text
      };
    }
  });

  console.log("[starter-app:bot] BOT_TOKEN missing, running in preview mode");

  await runtime.handle({
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
  } satisfies TelegramUpdate);
}

function keepProcessAlive() {
  setInterval(() => {
    // Keep preview mode alive so the root `pnpm dev` process keeps both services running.
  }, 60_000);
}

function hasRealToken(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return (
    normalized.length > 0 && !normalized.includes("your_") && !normalized.includes("placeholder")
  );
}

interface PollingBot extends BotInstance {
  getUpdates: (offset?: number) => Promise<TelegramUpdate[]>;
  setCommands: (commands: RegisteredCommand[]) => Promise<void>;
}

function createPollingBot(token: string): PollingBot {
  const apiBaseUrl = `https://api.telegram.org/bot${token}`;

  return {
    async getUpdates(offset?: number): Promise<TelegramUpdate[]> {
      const payload = await callTelegramApi<TelegramUpdate[]>(apiBaseUrl, "getUpdates", {
        allowed_updates: ["message"],
        offset,
        timeout: 25
      });
      return Array.isArray(payload) ? payload : [];
    },
    async sendMessage(
      chatId: number,
      text: string,
      options?: ReplyOptions
    ): Promise<TelegramMessage> {
      return callTelegramApi<TelegramMessage>(apiBaseUrl, "sendMessage", {
        chat_id: chatId,
        text,
        ...options
      });
    },
    async setCommands(commands: RegisteredCommand[]) {
      await callTelegramApi(apiBaseUrl, "setMyCommands", {
        commands: commands.map((command) => ({
          command: command.command,
          description: command.description ?? command.command
        }))
      });
    }
  };
}

async function callTelegramApi<TResponse>(
  apiBaseUrl: string,
  method: string,
  body: Record<string, unknown>
): Promise<TResponse> {
  const response = await fetch(`${apiBaseUrl}/${method}`, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });
  const payload = (await response.json()) as {
    description?: string;
    ok?: boolean;
    result?: TResponse;
  };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.description ?? `Telegram API ${method} failed`);
  }

  return payload.result as TResponse;
}
