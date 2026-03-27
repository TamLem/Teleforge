import { initiateCoordinatedFlow, templates } from "@teleforgex/bot";

import type { BotCommandDefinition } from "@teleforgex/bot";
import type { UserFlowStateManager } from "@teleforgex/core";

export function createStartCommand(
  miniAppUrl: string,
  flowStateManager: UserFlowStateManager,
  coordinationSecret = "task-shop-preview-secret"
): BotCommandDefinition {
  return {
    command: "start",
    description: "Open the Task Shop Mini App",
    async handler(context) {
      const template = templates.continueInMiniApp(
        "task-shop-browse",
        "Welcome to Task Shop. Browse Teleforge-flavored tasks and check out from the Mini App."
      );

      await initiateCoordinatedFlow(
        context.bot ?? {
          sendMessage: (_chatId, text, options) => context.reply(text, options)
        },
        flowStateManager,
        {
          buttonText: "Open Task Shop",
          chatId: context.chat.id,
          flowId: "task-shop-browse",
          initialStep: "catalog",
          payload: {
            entry: "start-command"
          },
          requestWriteAccess: true,
          returnText: "Back to Task Shop chat",
          secret: coordinationSecret,
          stayInChat: true,
          stepId: "catalog",
          text: template.text,
          userId: String(context.user.id),
          webAppUrl: miniAppUrl
        }
      );
    }
  };
}
