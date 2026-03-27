import { createBotRuntime, type TelegramMessage, type TelegramUpdate } from "@teleforgex/bot";

import { createStartCommand } from "../../../apps/bot/src/commands/start.ts";
import { createTasksCommand } from "../../../apps/bot/src/commands/tasks.ts";
import { createTaskShopFlowStateManager } from "../../../apps/bot/src/flowState.ts";
import { createOrderCompletedHandler } from "../../../apps/bot/src/handlers/orderCompleted.ts";

export interface CapturedMessage extends TelegramMessage {
  options?: Record<string, unknown>;
}

export function createMockTelegramHarness(
  miniAppUrl = "https://example.ngrok.app",
  coordinationSecret = "task-shop-preview-secret"
) {
  const runtime = createBotRuntime();
  const flowStateManager = createTaskShopFlowStateManager();
  const messages: CapturedMessage[] = [];
  let updateId = 0;
  let messageId = 100;

  runtime.registerCommands([
    createStartCommand(miniAppUrl, flowStateManager, coordinationSecret),
    createTasksCommand(flowStateManager)
  ]);
  runtime.router.onWebAppData(
    createOrderCompletedHandler(flowStateManager, coordinationSecret, miniAppUrl)
  );
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
