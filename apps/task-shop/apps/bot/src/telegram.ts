import type {
  BotCommandDefinition,
  BotInstance,
  ReplyOptions,
  TelegramMessage,
  TelegramReplyMarkup,
  TelegramUpdate
} from "@teleforge/bot";

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
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });

  const payload = (await response.json()) as TelegramApiResponse<T>;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.description ?? `Telegram API request failed (${response.status}).`);
  }

  return payload.result;
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
