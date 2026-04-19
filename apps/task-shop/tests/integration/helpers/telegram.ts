import { createTaskShopBotRuntime } from "../../../apps/bot/src/runtime.ts";

import type { TelegramMessage, TelegramUpdate } from "teleforge/bot";

export interface CapturedMessage extends TelegramMessage {
  options?: Record<string, unknown>;
}

export async function createMockTelegramHarness(
  miniAppUrl = "https://example.ngrok.app",
  flowSecret = "task-shop-preview-secret"
) {
  const runtime = await createTaskShopBotRuntime({
    flowSecret,
    miniAppUrl
  });
  const messages: CapturedMessage[] = [];
  let updateId = 0;
  let messageId = 100;

  runtime.bindBot({
    async sendMessage(chatId, text, options = {}) {
      messageId += 1;

      const message: CapturedMessage = {
        chat: {
          id: chatId
        },
        message_id: messageId,
        options,
        text
      };

      messages.push(message);
      return message;
    }
  });

  return {
    getMessages() {
      return [...messages];
    },
    async sendCommand(text: string) {
      await runtime.handle(createCommandUpdate(text, ++updateId));
    },
    async sendWebAppData(data: unknown) {
      await runtime.handle(createWebAppUpdate(data, ++updateId));
    }
  };
}

function createCommandUpdate(text: string, updateId: number): TelegramUpdate {
  return {
    message: {
      chat: {
        id: 1,
        type: "private"
      },
      from: {
        first_name: "Integration",
        id: 1,
        username: "integration_user"
      },
      message_id: updateId,
      text
    },
    update_id: updateId
  };
}

function createWebAppUpdate(data: unknown, updateId: number): TelegramUpdate {
  return {
    message: {
      chat: {
        id: 1,
        type: "private"
      },
      date: Math.floor(Date.now() / 1000),
      from: {
        first_name: "Integration",
        id: 1,
        username: "integration_user"
      },
      message_id: updateId,
      web_app_data: {
        data: JSON.stringify(data)
      }
    },
    update_id: updateId
  };
}
