import https from "node:https";

import type {
  BotCommandDefinition,
  BotInstance,
  ReplyOptions,
  TelegramMessage,
  TelegramReplyMarkup,
  TelegramUpdate
} from "@teleforgex/bot";

interface TelegramApiResponse<T> {
  description?: string;
  ok: boolean;
  result: T;
}

export interface PollingBot extends BotInstance {
  getUpdates(offset?: number): Promise<TelegramUpdate[]>;
  setCommands(
    commands: Iterable<Pick<BotCommandDefinition, "command" | "description">>
  ): Promise<void>;
}

export function createPollingBot(token: string): PollingBot {
  const baseUrl = `https://api.telegram.org/bot${token}`;

  return {
    async getUpdates(offset) {
      const response = await request<TelegramUpdate[]>(`${baseUrl}/getUpdates`, {
        allowed_updates: ["message"],
        offset,
        timeout: 25
      });

      return response;
    },
    async sendMessage(chatId, text, options = {}) {
      return request<TelegramMessage>(`${baseUrl}/sendMessage`, {
        ...toTelegramSendMessageOptions(options),
        chat_id: chatId,
        text
      });
    },
    async setCommands(commands) {
      await request(`${baseUrl}/setMyCommands`, {
        commands: Array.from(commands, (command) => ({
          command: command.command,
          description: command.description ?? command.command
        }))
      });
    }
  };
}

export function createPreviewBot(log: (message: string) => void): BotInstance {
  let messageId = 0;

  return {
    async sendMessage(chatId, text, options = {}) {
      messageId += 1;

      log(
        JSON.stringify(
          {
            chatId,
            options,
            text
          },
          null,
          2
        )
      );

      return {
        chat: {
          id: chatId
        },
        message_id: messageId,
        text
      };
    }
  };
}

async function request<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const methodName = extractTelegramMethod(url);
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await postJson(url, body);
      const payload = JSON.parse(response.body) as TelegramApiResponse<T>;

      if (response.statusCode < 200 || response.statusCode >= 300 || !payload.ok) {
        throw new Error(
          payload.description ??
            `Telegram API request failed (${response.statusCode}) while calling ${methodName}.`
        );
      }

      return payload.result;
    } catch (error) {
      lastError = error;

      if (!isRetryableTelegramNetworkError(error) || attempt === 3) {
        break;
      }

      await sleep(attempt * 500);
    }
  }

  throw enrichTelegramError(lastError, methodName);
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

function extractTelegramMethod(url: string): string {
  const pathname = new URL(url).pathname;
  const segments = pathname.split("/").filter(Boolean);
  return segments.at(-1) ?? "unknown";
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

function enrichTelegramError(error: unknown, methodName: string): Error {
  if (error instanceof Error) {
    return new Error(`Telegram API ${methodName} failed: ${error.message}`, { cause: error });
  }

  return new Error(`Telegram API ${methodName} failed with an unknown error.`);
}

function sleep(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
  });
}
