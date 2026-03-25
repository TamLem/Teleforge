import { sendFlowInit, templates, type BotCommandDefinition } from "@teleforge/bot";

export function createStartCommand(
  miniAppUrl: string,
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

      await sendFlowInit(
        context.bot ?? {
          sendMessage: (_chatId, text, options) => context.reply(text, options)
        },
        {
          buttonText: "Open Task Shop",
          chatId: context.chat.id,
          flowId: "task-shop-browse",
          payload: {
            entry: "start-command"
          },
          requestWriteAccess: true,
          returnText: "Back to Task Shop chat",
          secret: coordinationSecret,
          stayInChat: true,
          stepId: "catalog",
          text: template.text,
          webAppUrl: miniAppUrl
        }
      );
    }
  };
}
