import type {
  BotCommandDefinition,
  CommandContext,
  CommandHandler,
  GeneratedCommandResponse,
  RegisteredCommand
} from "../router/types.js";
import type { TeleforgeManifest } from "@teleforge/core";

export function createDefaultHelpHandler(
  commands: ReadonlyArray<Pick<RegisteredCommand, "command" | "description">> = []
): CommandHandler {
  return async (context) => {
    const lines =
      commands.length === 0
        ? ["Use /start to launch the Mini App."]
        : commands.map(
            (command) =>
              `/${command.command}${command.description ? ` - ${command.description}` : ""}`
          );

    await context.reply(lines.join("\n"));
  };
}

export function createDefaultStartHandler(manifest: TeleforgeManifest): CommandHandler {
  const webAppUrl = resolveMiniAppUrl(manifest);

  return async (context) => {
    await context.replyWithWebApp(`Welcome to ${manifest.name}!`, "Open App", webAppUrl);
  };
}

export function wrapCommandDefinition(definition: BotCommandDefinition): CommandHandler {
  return async (context: CommandContext) => {
    const result = await definition.handler(context as CommandContext & never);

    if (isGeneratedCommandResponse(result)) {
      if (result.webApp) {
        await context.replyWithWebApp(result.text, result.webApp.buttonText, result.webApp.url);
        return;
      }

      await context.reply(result.text, result.options);
    }
  };
}

export function toRegisteredCommand(definition: BotCommandDefinition): RegisteredCommand {
  return {
    command: definition.command,
    description: definition.description,
    source: "runtime"
  };
}

export function toManifestCommands(manifest: TeleforgeManifest | undefined): RegisteredCommand[] {
  return (manifest?.bot.commands ?? []).map((command) => ({
    command: command.command,
    description: command.description,
    handlerPath: command.handler,
    source: "manifest"
  }));
}

function isGeneratedCommandResponse(value: unknown): value is GeneratedCommandResponse {
  return typeof value === "object" && value !== null && "text" in value;
}

function resolveMiniAppUrl(manifest: TeleforgeManifest): string {
  if (manifest.miniApp.url) {
    return manifest.miniApp.url;
  }

  return `https://t.me/${manifest.bot.username}/app`;
}
