import readline from "node:readline";
import { pathToFileURL } from "node:url";

interface CapturedTelegramMessage {
  options?: Record<string, unknown>;
  text?: string;
}

interface BotRuntime {
  bindBot(bot: {
    sendMessage(
      chatId: number | string,
      text: string,
      options?: Record<string, unknown>
    ): Promise<Record<string, unknown>>;
  }): void;
  getCommands(): Array<{ command: string }>;
  handle(update: TelegramUpdate): Promise<void>;
}

interface RuntimeModule {
  createDevBotRuntime?: (options?: { miniAppUrl?: string }) => BotRuntime | Promise<BotRuntime>;
  default?: (options?: { miniAppUrl?: string }) => BotRuntime | Promise<BotRuntime>;
}

interface WorkerProfile {
  appContext: {
    launchMode: string;
  };
  user: {
    first_name: string;
    id: number;
    language_code?: string;
    username?: string;
  };
}

interface TelegramUpdate {
  message: {
    chat: {
      id: number;
      type: "private";
    };
    date: number;
    from: TelegramUser;
    message_id: number;
    text?: string;
    web_app_data?: {
      data: string;
    };
  };
  update_id: number;
}

interface TelegramUser {
  first_name: string;
  id: number;
  language_code?: string;
  username?: string;
}

type WorkerRequest =
  | {
      id: string;
      profile: WorkerProfile;
      text: string;
      type: "command";
    }
  | {
      id: string;
      profile: WorkerProfile;
      type: "status";
    }
  | {
      data: string;
      id: string;
      profile: WorkerProfile;
      type: "web_app_data";
    };

void main();

async function main(): Promise<void> {
  const runtime = await loadRuntime();
  const registeredCommands = runtime.getCommands().map((command) => command.command);

  let capturedMessages: CapturedTelegramMessage[] = [];
  let outboundMessageId = 1_000;
  let inboundMessageId = 100;
  let updateId = 1;

  runtime.bindBot({
    async sendMessage(chatId, text, options = {}) {
      outboundMessageId += 1;
      const message = {
        chat: {
          id: chatId,
          type: "private"
        },
        message_id: outboundMessageId,
        options,
        text
      };

      capturedMessages.push(message);
      return message;
    }
  });

  const lines = readline.createInterface({
    input: process.stdin
  });

  lines.on("line", async (line) => {
    if (line.trim().length === 0) {
      return;
    }

    let request: WorkerRequest;

    try {
      request = JSON.parse(line) as WorkerRequest;
    } catch (error) {
      writeResponse({
        error: error instanceof Error ? error.message : "Invalid worker request."
      });
      return;
    }

    try {
      capturedMessages = [];

      if (request.type === "status") {
        writeResponse({
          id: request.id,
          result: {
            commands: registeredCommands,
            messages: []
          }
        });
        return;
      }

      if (request.type === "command") {
        updateId += 1;
        inboundMessageId += 1;
        await runtime.handle(
          createCommandUpdate(request.text, request.profile, {
            messageId: inboundMessageId,
            updateId
          })
        );
      } else {
        updateId += 1;
        inboundMessageId += 1;
        await runtime.handle(
          createWebAppDataUpdate(request.data, request.profile, {
            messageId: inboundMessageId,
            updateId
          })
        );
      }

      writeResponse({
        id: request.id,
        result: {
          commands: registeredCommands,
          messages: capturedMessages
        }
      });
    } catch (error) {
      writeResponse({
        error: error instanceof Error ? error.message : "Simulator bot execution failed.",
        id: request.id
      });
    }
  });
}

async function loadRuntime(): Promise<BotRuntime> {
  const entryPath = process.env.TELEFORGE_SIMULATOR_BOT_ENTRY;
  if (!entryPath) {
    throw new Error("TELEFORGE_SIMULATOR_BOT_ENTRY is required.");
  }

  const module = (await import(pathToFileURL(entryPath).href)) as RuntimeModule;
  const factory =
    (typeof module.createDevBotRuntime === "function" ? module.createDevBotRuntime : undefined) ??
    (typeof module.default === "function" ? module.default : undefined);

  if (!factory) {
    throw new Error(
      `Bot runtime module ${entryPath} must export createDevBotRuntime(options).`
    );
  }

  const runtime = await factory({
    miniAppUrl: process.env.TELEFORGE_SIMULATOR_APP_URL
  });

  if (!runtime || typeof runtime.bindBot !== "function" || typeof runtime.handle !== "function") {
    throw new Error(`Bot runtime module ${entryPath} did not return a valid BotRuntime.`);
  }

  return runtime;
}

function createCommandUpdate(
  text: string,
  profile: WorkerProfile,
  ids: { messageId: number; updateId: number }
): TelegramUpdate {
  return {
    message: {
      chat: {
        id: profile.user.id,
        type: "private"
      },
      date: Math.floor(Date.now() / 1_000),
      from: createUser(profile),
      message_id: ids.messageId,
      text
    },
    update_id: ids.updateId
  };
}

function createWebAppDataUpdate(
  data: string,
  profile: WorkerProfile,
  ids: { messageId: number; updateId: number }
): TelegramUpdate {
  return {
    message: {
      chat: {
        id: profile.user.id,
        type: "private"
      },
      date: Math.floor(Date.now() / 1_000),
      from: createUser(profile),
      message_id: ids.messageId,
      web_app_data: {
        data
      }
    },
    update_id: ids.updateId
  };
}

function createUser(profile: WorkerProfile): TelegramUser {
  return {
    first_name: profile.user.first_name,
    id: profile.user.id,
    language_code: profile.user.language_code,
    username: profile.user.username
  };
}

function writeResponse(payload: {
  error?: string;
  id?: string;
  result?: {
    commands: string[];
    messages: CapturedTelegramMessage[];
  };
}): void {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}
