import {
  createDefaultHelpHandler,
  createDefaultStartHandler,
  toManifestCommands,
  toRegisteredCommand,
  wrapCommandDefinition
} from "./handlers/commands.js";
import { BotRouter } from "./router/router.js";
import { normalizeCommandName } from "./utils/parse.js";

import type {
  BotCommandDefinition,
  BotInstance,
  CreateBotRuntimeOptions,
  RegisteredCommand,
  TelegramUpdate
} from "./router/types.js";

export interface BotRuntime {
  bindBot: (bot: BotInstance) => void;
  getCommands: () => RegisteredCommand[];
  handle: (update: TelegramUpdate) => Promise<void>;
  registerCommands: (commands: Iterable<BotCommandDefinition>) => void;
  router: BotRouter;
}

/**
 * Creates a thin runtime wrapper around {@link BotRouter} that can bootstrap default manifest
 * commands and adapt generated command definitions into router handlers.
 */
export function createBotRuntime(options: CreateBotRuntimeOptions = {}): BotRuntime {
  const manifest = options.manifest;
  const router = new BotRouter({
    bot: options.bot
  });
  const registry = new Map<string, RegisteredCommand>(
    toManifestCommands(manifest).map((command) => [normalizeCommandName(command.command), command])
  );

  if (manifest && registry.has("start")) {
    router.onStart(createDefaultStartHandler(manifest));
  }

  if (registry.has("help")) {
    router.onHelp(createDefaultHelpHandler(Array.from(registry.values())));
  }

  return {
    bindBot(bot: BotInstance) {
      router.setBot(bot);
    },
    getCommands() {
      return Array.from(registry.values());
    },
    async handle(update: TelegramUpdate) {
      await router.handle(update);
    },
    registerCommands(commands: Iterable<BotCommandDefinition>) {
      for (const definition of commands) {
        const normalizedCommand = normalizeCommandName(definition.command);
        registry.set(normalizedCommand, {
          ...registry.get(normalizedCommand),
          ...toRegisteredCommand(definition)
        });

        const wrapped = wrapCommandDefinition(definition);

        if (normalizedCommand === "start") {
          router.onStart(wrapped);
        } else if (normalizedCommand === "help") {
          router.onHelp(wrapped);
        } else {
          router.command(normalizedCommand, wrapped);
        }
      }

      if (!registry.has("help") && hasHelpHandler(commands)) {
        router.onHelp(createDefaultHelpHandler(Array.from(registry.values())));
      }
    },
    router
  };
}

function hasHelpHandler(commands: Iterable<BotCommandDefinition>): boolean {
  for (const command of commands) {
    if (normalizeCommandName(command.command) === "help") {
      return true;
    }
  }

  return false;
}
