import { config as loadDotenv } from "dotenv";
import https from "node:https";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createBotRuntime,
  type BotInstance,
  type RegisteredCommand,
  type ReplyOptions,
  type TelegramMessage,
  type TelegramReplyMarkup,
  type TelegramUpdate
} from "@teleforge/bot";

loadStarterEnv();

const miniAppUrl = readNonEmptyEnv("MINI_APP_URL") ?? "https://example.ngrok.app";

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

  const token = readNonEmptyEnv("BOT_TOKEN");
  if (!hasUsableToken(token)) {
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
    `[starter-app:bot] polling Telegram for updates (${commands.length} commands registered)`
  );

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
    async sendMessage(chatId, text, options = {}) {
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
    // Keep preview mode alive so `teleforge dev` keeps both services running.
  }, 60_000);
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
      options: ReplyOptions = {}
    ): Promise<TelegramMessage> {
      return callTelegramApi<TelegramMessage>(apiBaseUrl, "sendMessage", {
        chat_id: chatId,
        text,
        ...toTelegramSendMessageOptions(options)
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
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await postJson(`${apiBaseUrl}/${method}`, body);
      const payload = JSON.parse(response.body) as {
        description?: string;
        ok?: boolean;
        result?: TResponse;
      };

      if (response.statusCode < 200 || response.statusCode >= 300 || !payload.ok) {
        throw new Error(payload.description ?? `Telegram API ${method} failed`);
      }

      return payload.result as TResponse;
    } catch (error) {
      lastError = error;

      if (!isRetryableTelegramNetworkError(error) || attempt === 3) {
        break;
      }

      await sleep(attempt * 500);
    }
  }

  if (lastError instanceof Error) {
    throw new Error(`Telegram API ${method} failed: ${lastError.message}`, { cause: lastError });
  }

  throw new Error(`Telegram API ${method} failed`);
}

function toTelegramSendMessageOptions(options: ReplyOptions): Record<string, unknown> {
  return {
    disable_web_page_preview: options.disable_web_page_preview,
    parse_mode: options.parse_mode,
    reply_markup: serializeReplyMarkup(options.reply_markup),
    reply_to_message_id: options.reply_to_message_id
  };
}

function serializeReplyMarkup(markup?: TelegramReplyMarkup): TelegramReplyMarkup | undefined {
  return markup ? { inline_keyboard: markup.inline_keyboard } : undefined;
}

interface JsonResponse {
  body: string;
  statusCode: number;
}

function postJson(url: string, body: Record<string, unknown>): Promise<JsonResponse> {
  const payload = JSON.stringify(body);
  const target = new URL(url);
  const timeoutSeconds = typeof body.timeout === "number" ? body.timeout : 0;
  const timeoutMs = Math.max(10_000, (timeoutSeconds + 10) * 1_000);

  return new Promise<JsonResponse>((resolve, reject) => {
    const request = https.request(
      {
        family: 4,
        headers: {
          "content-length": Buffer.byteLength(payload),
          "content-type": "application/json"
        },
        hostname: target.hostname,
        method: "POST",
        path: `${target.pathname}${target.search}`,
        port: target.port ? Number(target.port) : 443
      },
      (response) => {
        let responseBody = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          resolve({
            body: responseBody,
            statusCode: response.statusCode ?? 0
          });
        });
      }
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Telegram API request timed out after ${timeoutMs}ms.`));
    });
    request.on("error", (error) => {
      reject(error);
    });
    request.write(payload);
    request.end();
  });
}

function isRetryableTelegramNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const nodeError = error as Error & { code?: string };
  return (
    nodeError.code === "ECONNRESET" ||
    nodeError.code === "ENETUNREACH" ||
    nodeError.code === "ETIMEDOUT" ||
    error.message.includes("timed out")
  );
}

function sleep(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
  });
}

function loadStarterEnv() {
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

function readNonEmptyEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function hasUsableToken(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();
  return (
    trimmed.includes(":") && !normalized.includes("your_") && !normalized.includes("placeholder")
  );
}
