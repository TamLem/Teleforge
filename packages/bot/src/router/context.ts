import { parseWebAppPayload } from "../handlers/webapp-data.js";
import { createWebAppReplyOptions } from "../handlers/webapp.js";

import type {
  BotInstance,
  CommandContext,
  ReplyOptions,
  TelegramMessage,
  TelegramUpdate,
  UpdateContext,
  WebAppContext,
  WebAppDataContext
} from "./types.js";

export function createUpdateContext(
  bot: BotInstance | null,
  update: TelegramUpdate
): UpdateContext {
  const message = resolveMessage(update);
  const chat = message?.chat ?? null;
  const user = message?.from ?? null;
  const state: Record<string, unknown> = {};

  return {
    bot,
    chat,
    message,
    reply(text: string, options?: ReplyOptions) {
      const activeBot = requireBot(bot);
      const activeChat = requireMessage(message).chat;
      return activeBot.sendMessage(activeChat.id, text, options);
    },
    replyWithWebApp(text: string, buttonText: string, url: string) {
      const activeBot = requireBot(bot);
      const activeChat = requireMessage(message).chat;
      return activeBot.sendMessage(activeChat.id, text, createWebAppReplyOptions(buttonText, url));
    },
    state,
    update,
    user
  };
}

export function createCommandContext(
  context: UpdateContext,
  command: string,
  args: string[]
): CommandContext {
  const message = requireMessage(context.message);
  const user = requireUser(message);

  return {
    ...context,
    args,
    chat: message.chat,
    command,
    message,
    user
  };
}

export function createWebAppContext(context: UpdateContext): WebAppContext {
  const message = requireMessage(context.message);

  return {
    ...context,
    buttonText: message.web_app_data?.button_text ?? null,
    chat: message.chat,
    data: message.web_app_data?.data ?? "",
    message,
    user: message.from ?? null
  };
}

export function createWebAppDataContext(context: UpdateContext): WebAppDataContext {
  const message = requireMessage(context.message);
  const data = message.web_app_data?.data ?? "";
  const messageId = message.message_id ?? null;

  return {
    ...context,
    answer(text: string) {
      const replyOptions =
        messageId === null
          ? undefined
          : {
              reply_to_message_id: messageId
            };

      return context.reply(`✅ ${text}`, replyOptions);
    },
    chat: message.chat,
    data,
    message,
    messageId,
    payload: parseWebAppPayload(data),
    timestamp: message.date ?? null,
    user: message.from ?? null
  };
}

function resolveMessage(update: TelegramUpdate): TelegramMessage | null {
  return update.message ?? update.edited_message ?? update.callback_query?.message ?? null;
}

function requireBot(bot: BotInstance | null): BotInstance {
  if (!bot) {
    throw new Error("Bot instance is not configured. Call `setBot()` or bind a bot at runtime.");
  }

  return bot;
}

function requireMessage(message: TelegramMessage | null): TelegramMessage {
  if (!message) {
    throw new Error("Telegram update does not contain a message.");
  }

  return message;
}

function requireUser(message: TelegramMessage): NonNullable<TelegramMessage["from"]> {
  if (!message.from) {
    throw new Error("Telegram command updates require a sender.");
  }

  return message.from;
}
