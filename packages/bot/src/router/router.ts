import { createDefaultWebAppDataHandler } from "../handlers/webapp-data.js";
import { normalizeCommandName, parseCommand } from "../utils/parse.js";

import {
  createCommandContext,
  createUpdateContext,
  createWebAppContext,
  createWebAppDataContext
} from "./context.js";

import type {
  BotInstance,
  CommandContext,
  CommandHandler,
  Middleware,
  TelegramUpdate,
  UpdateContext,
  WebAppDataHandler,
  WebAppHandler
} from "./types.js";

export interface BotRouterOptions {
  bot?: BotInstance;
}

/**
 * Middleware-capable router for Telegram bot updates, including commands and `web_app_data`
 * payloads emitted by a Teleforge Mini App.
 */
export class BotRouter {
  private bot: BotInstance | null;

  private commands = new Map<string, CommandHandler>();

  private helpHandler?: CommandHandler;

  private middleware: Middleware[] = [];

  private startHandler?: CommandHandler;

  private webAppHandler?: WebAppHandler;

  private webAppDataHandler?: WebAppDataHandler;

  constructor(options: BotRouterOptions = {}) {
    this.bot = options.bot ?? null;
  }

  /**
   * Registers a handler for a normalized slash command.
   */
  command(name: string, handler: CommandHandler): void {
    this.commands.set(normalizeCommandName(name), handler);
  }

  async handle(update: TelegramUpdate): Promise<void> {
    const context = createUpdateContext(this.bot, update);

    await this.runMiddleware(context, async () => {
      const message = context.message;
      if (!message) {
        return;
      }

      const parsedCommand = parseCommand(message.text);
      if (parsedCommand) {
        const commandContext = createCommandContext(
          context,
          parsedCommand.command,
          parsedCommand.args
        );
        await this.handleCommand(commandContext);
        return;
      }

      if (message.web_app_data) {
        await this.handleWebAppData(context);
      }
    });
  }

  onHelp(handler: CommandHandler): void {
    this.helpHandler = handler;
  }

  onStart(handler: CommandHandler): void {
    this.startHandler = handler;
  }

  onWebApp(handler: WebAppHandler): void {
    this.webAppHandler = handler;
  }

  /**
   * Registers a structured handler for Telegram `web_app_data` payloads.
   */
  onWebAppData(handler: WebAppDataHandler): void {
    this.webAppDataHandler = handler;
  }

  setBot(bot: BotInstance): void {
    this.bot = bot;
  }

  use(middleware: Middleware): void {
    this.middleware.push(middleware);
  }

  private async handleCommand(context: CommandContext): Promise<void> {
    if (context.command === "start" && this.startHandler) {
      await this.startHandler(context);
      return;
    }

    if (context.command === "help" && this.helpHandler) {
      await this.helpHandler(context);
      return;
    }

    const handler = this.commands.get(context.command);
    if (handler) {
      await handler(context);
      return;
    }

    await context.reply("Unknown command. Use /help for available commands.");
  }

  private async handleWebAppData(context: UpdateContext): Promise<void> {
    const dataContext = createWebAppDataContext(context);

    if (this.webAppDataHandler) {
      await this.webAppDataHandler(dataContext);
      return;
    }

    if (this.webAppHandler) {
      await this.webAppHandler(createWebAppContext(context));
      return;
    }

    await createDefaultWebAppDataHandler()(dataContext);
  }

  private async runMiddleware(
    context: UpdateContext,
    terminal: () => Promise<void>
  ): Promise<void> {
    let index = -1;

    const dispatch = async (nextIndex: number): Promise<void> => {
      if (nextIndex <= index) {
        throw new Error("Middleware called `next()` multiple times.");
      }

      index = nextIndex;

      if (nextIndex === this.middleware.length) {
        await terminal();
        return;
      }

      const middleware = this.middleware[nextIndex];
      if (!middleware) {
        return;
      }

      await middleware(context, () => dispatch(nextIndex + 1));
    };

    await dispatch(0);
  }
}
