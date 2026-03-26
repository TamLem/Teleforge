import type { BotCommandDefinition } from "@teleforge/bot";

export function createStartCommand(miniAppUrl: string): BotCommandDefinition {
  return {
    command: "start",
    description: "Open the Starter App",
    async handler(context) {
      await context.replyWithWebApp(
        "Starter App is ready. Open the Mini App to inspect Telegram theme, user data, and MainButton behavior.",
        "Open Starter App",
        miniAppUrl
      );
    }
  };
}
