import https from "node:https";

import {
  createBotRuntime,
  extractSharedPhoneContact,
  nodeHttpAdapter,
  verifyActionCallback,
  type BotInstance,
  type BotRuntime,
  type CallbackQueryHandler,
  type Middleware,
  type ReplyOptions,
  type TelegramMessage,
  type TelegramUpdate,
  type WebAppDataHandler
} from "@teleforgex/bot";
import {
  createSignedActionContext,
  MemorySessionStorageAdapter,
  SessionManager,
  validateActionContext,
  type ActionContextToken,
  type SignContextFn
} from "@teleforgex/core";

import { loadTeleforgeApp } from "./config.js";
import {
  createFlowCommands,
  loadActionRegistry,
  loadTeleforgeFlows
} from "./discovery.js";

import type { DiscoveredFlowModule } from "./discovery.js";
import type { ActionFlowActionDefinition, ActionFlowDefinition } from "./flow-definition.js";
import type { TeleforgeAppConfig } from "@teleforgex/core";

export interface CreateDiscoveredBotRuntimeOptions {
  app?: TeleforgeAppConfig;
  cwd?: string;
  flowSecret: string;
  miniAppUrl: string;
  phoneAuthSecret?: string;
  services?: unknown;
  sessionManager?: SessionManager;
  sessionTtlSeconds?: number;
}

export interface DiscoveredBotRuntime extends BotRuntime {
  getSessionManager(): SessionManager;
  handleChatHandoff(input: { message: string; context: ActionContextToken; replyMarkup?: Record<string, unknown> }): Promise<void>;
}

export interface StartTeleforgeBotOptions {
  app?: TeleforgeAppConfig;
  cwd?: string;
  flowSecret?: string;
  miniAppUrl?: string;
  phoneAuthSecret?: string;
  services?: unknown;
  sessionManager?: SessionManager;
  sessionTtlSeconds?: number;
  token?: string;
}

export interface StartTeleforgeBotResult {
  runtime: DiscoveredBotRuntime;
  stop: () => void;
}

export interface CreateTeleforgeWebhookHandlerOptions {
  app?: TeleforgeAppConfig;
  cwd?: string;
  flowSecret?: string;
  miniAppUrl?: string;
  phoneAuthSecret?: string;
  services?: unknown;
  sessionManager?: SessionManager;
  sessionTtlSeconds?: number;
}

const DEFAULT_SESSION_TTL = 900;

export async function createDiscoveredBotRuntime(
  options: CreateDiscoveredBotRuntimeOptions
): Promise<DiscoveredBotRuntime> {
  const cwd = options.cwd ?? process.cwd();
  const app = options.app ?? (await loadTeleforgeApp(cwd)).app;
  const flows = await loadTeleforgeFlows({ app, cwd });
  const actions = loadActionRegistry(flows);

  const runtime = createBotRuntime();

  let boundBot: BotInstance | null = null;
  const originalBindBot = runtime.bindBot;
  runtime.bindBot = (bot) => {
    boundBot = bot;
    originalBindBot(bot);
  };

  const sessionManager =
    options.sessionManager ??
    new SessionManager(
      new MemorySessionStorageAdapter({
        defaultTTL: options.sessionTtlSeconds ?? DEFAULT_SESSION_TTL,
        namespace: app.app.id
      })
    );

  const secret = options.flowSecret;
  const miniAppUrl = options.miniAppUrl;
  const services = options.services;

  runtime.registerCommands(
    createFlowCommands({
      appId: app.app.id,
      flows,
      miniAppUrl,
      secret,
      services,
      sessionManager
    })
  );

  runtime.router.use(
    createPhoneContactMiddleware({
      flows,
      miniAppUrl,
      secret,
      services,
      sessionManager
    })
  );

  runtime.router.use(
    createLocationMiddleware({
      flows,
      miniAppUrl,
      secret,
      services,
      sessionManager
    })
  );

  runtime.router.onCallbackQuery(
    createActionCallbackHandler({
      actions,
      flows,
      secret,
      services,
      sessionManager
    })
  );

  runtime.router.onWebAppData(
    createWebAppDataHandler({
      actions,
      flows,
      secret,
      services,
      sessionManager
    })
  );

  return {
    ...runtime,

    getSessionManager: () => sessionManager,

    async handleChatHandoff(input: { message: string; context: ActionContextToken; replyMarkup?: Record<string, unknown> }) {
      if (!boundBot) {
        throw new Error("Bot instance has not been bound.");
      }
      await boundBot.sendMessage(input.context.userId, input.message, {
        reply_markup: input.replyMarkup as Parameters<typeof boundBot.sendMessage>[2] extends { reply_markup?: infer R } ? R : undefined
      });
    }
  };
}

export async function createTeleforgeWebhookHandler(
  options: CreateTeleforgeWebhookHandlerOptions
) {
  const cwd = options.cwd ?? process.cwd();
  const app = options.app ?? (await loadTeleforgeApp(cwd)).app;
  const flowSecret = options.flowSecret ?? `${app.app.id}-preview-secret`;
  const miniAppUrl = options.miniAppUrl ?? "https://example.ngrok.app";

  const runtime = await createDiscoveredBotRuntime({
    app,
    cwd,
    flowSecret,
    miniAppUrl,
    phoneAuthSecret: options.phoneAuthSecret,
    services: options.services,
    sessionManager: options.sessionManager,
    sessionTtlSeconds: options.sessionTtlSeconds
  });

  return nodeHttpAdapter(runtime as Pick<BotRuntime, "handle">);
}

export async function startTeleforgeBot(
  options: StartTeleforgeBotOptions = {}
): Promise<StartTeleforgeBotResult> {
  const cwd = options.cwd ?? process.cwd();
  const app = options.app ?? (await loadTeleforgeApp(cwd)).app;

  const tokenEnv = app.bot.tokenEnv;
  const token = options.token ?? readEnv(tokenEnv);

  const flowSecret = options.flowSecret ?? readEnv("TELEFORGE_FLOW_SECRET") ?? `${app.app.id}-preview-secret`;
  const miniAppUrl = options.miniAppUrl ?? readEnv("MINI_APP_URL") ?? "https://example.ngrok.app";

  const runtime = await createDiscoveredBotRuntime({
    app,
    cwd,
    flowSecret,
    miniAppUrl,
    phoneAuthSecret: options.phoneAuthSecret,
    services: options.services,
    sessionManager: options.sessionManager,
    sessionTtlSeconds: options.sessionTtlSeconds
  });

  const commands = runtime.getCommands();

  if (!token) {
    runtime.bindBot(createPreviewBot());
    console.log("[teleforge:bot] BOT_TOKEN missing, running in preview mode");
    return { runtime, stop: () => {} };
  }

  const delivery = app.runtime.bot?.delivery ?? "polling";

  if (delivery === "webhook") {
    const bot = createTeleforgeWebhookBot(token);
    runtime.bindBot(bot);
    await bot.setCommands(commands);
    console.log(`[teleforge:bot] webhook delivery mode (${commands.length} commands registered)`);
    return { runtime, stop: () => {} };
  }

  const bot = createTeleforgePollingBot(token);
  runtime.bindBot(bot);
  try {
    await bot.setCommands(commands);
  } catch (err) {
    console.error("[teleforge:bot] failed to register bot commands:", err instanceof Error ? err.message : err);
  }

  console.log(`[teleforge:bot] polling Telegram (${commands.length} commands registered)`);

  let stopped = false;
  let offset: number | undefined;

  async function poll() {
    if (stopped) return;
    try {
      const updates = await bot.getUpdates(offset);
      for (const update of updates) {
        offset = typeof update.update_id === "number" ? update.update_id + 1 : offset;
        await runtime.handle(update);
      }
    } catch (error) {
      console.error("[teleforge:bot] polling error:", error);
      await new Promise((r) => setTimeout(r, 5_000));
    }
    if (!stopped) poll();
  }

  poll();

  return { runtime, stop: () => { stopped = true; } };
}

// Phone contact middleware

interface PhoneContactMiddlewareOptions {
  flows: readonly DiscoveredFlowModule[];
  miniAppUrl: string;
  secret: string;
  services?: unknown;
  sessionManager: SessionManager;
}

function createPhoneContactMiddleware(
  options: PhoneContactMiddlewareOptions
): Middleware {
  const handlersByFlow = collectContactHandlers(options.flows);

  return async (ctx, next) => {
    if (!ctx.update.message) {
      return next();
    }

    const contact = ctx.update.message.contact;
    console.log("[bot:contact] message received, has contact:", Boolean(contact));

    const shared = extractSharedPhoneContact(ctx.update);
    if (!shared) {
      console.log("[bot:contact] extractSharedPhoneContact returned null — not self-shared or invalid");
      return next();
    }

    console.log("[bot:contact] shared contact extracted, phone:", shared.normalizedPhoneNumber);

    if (handlersByFlow.size === 0) {
      return next();
    }

    if (handlersByFlow.size > 1) {
      console.warn(
        "[teleforge:bot] Multiple onContact handlers registered. Executing the first one."
      );
    }

    const entry = handlersByFlow.entries().next().value;
    if (!entry) {
      return next();
    }

    const [flowId, handler] = entry;
    const user = ctx.user;
    if (!user || !handler) {
      return next();
    }

    // Dismiss the contact keyboard before delivering to the handler
    try {
      await ctx.reply("Phone number received.", {
        reply_markup: { remove_keyboard: true }
      });
    } catch (err) {
      console.error("[bot:contact] failed to dismiss keyboard:", err instanceof Error ? err.message : err);
    }

    const sign = async (params: Parameters<SignContextFn>[0]) => {
      const now = Math.floor(Date.now() / 1000);
      const token = createSignedActionContext(
        {
          allowedActions: params.allowedActions,
          appId: flowId,
          expiresAt: now + 900,
          flowId: params.flowId ?? "shop",
          issuedAt: now,
          screenId: params.screenId,
          subject: params.subject,
          userId: String(user.id)
        },
        options.secret
      );
      const url = new URL(options.miniAppUrl);
      url.searchParams.set("tgWebAppStartParam", token);
      return url.toString();
    };

    await handler({
      ctx: {
        ...ctx,
        bot: ctx.bot,
        chat: ctx.chat,
        user: user,
        message: ctx.update.message ?? null,
        reply: async (text: string, replyOptions?: ReplyOptions) => {
          await ctx.bot!.sendMessage(ctx.chat!.id, text, replyOptions);
          return {} as TelegramMessage;
        },
        replyWithWebApp: async (text: string, buttonText: string, url: string) => {
          await ctx.bot!.sendMessage(ctx.chat!.id, text, {
            reply_markup: {
              inline_keyboard: [[{ text: buttonText, web_app: { url } }]]
            }
          });
          return {} as TelegramMessage;
        },
        state: {},
        update: ctx.update
      },
      services: options.services as never,
      shared: {
        normalizedPhone: shared.normalizedPhoneNumber,
        phoneNumber: shared.phoneNumber,
        telegramUserId: shared.telegramUserId
      },
      sign
    });
  };
}

// Location middleware

interface LocationMiddlewareOptions {
  flows: readonly DiscoveredFlowModule[];
  miniAppUrl: string;
  secret: string;
  services?: unknown;
  sessionManager: SessionManager;
}

function createLocationMiddleware(
  options: LocationMiddlewareOptions
): Middleware {
  const handlersByFlow = collectLocationHandlers(options.flows);

  return async (ctx, next) => {
    const location = ctx.update.message?.location;
    if (!location) {
      return next();
    }

    if (handlersByFlow.size === 0) {
      return next();
    }

    if (handlersByFlow.size > 1) {
      console.warn(
        "[teleforge:bot] Multiple onLocation handlers registered. Executing the first one."
      );
    }

    const entry = handlersByFlow.entries().next().value;
    if (!entry) {
      return next();
    }

    const [locationFlowId, handler] = entry;
    const user = ctx.user;
    if (!user || !handler) {
      return next();
    }

    // Dismiss the location keyboard before delivering to the handler
    await ctx.reply("Location received.", {
      reply_markup: { remove_keyboard: true }
    });

    const sign = async (params: Parameters<SignContextFn>[0]) => {
      const now = Math.floor(Date.now() / 1000);
      const token = createSignedActionContext(
        {
          allowedActions: params.allowedActions,
          appId: "",
          expiresAt: now + 900,
          flowId: params.flowId ?? locationFlowId,
          issuedAt: now,
          screenId: params.screenId,
          subject: params.subject,
          userId: String(user.id)
        },
        options.secret
      );
      const url = new URL(options.miniAppUrl);
      url.searchParams.set("tgWebAppStartParam", token);
      return url.toString();
    };

    await handler({
      ctx: {
        ...ctx,
        bot: ctx.bot,
        chat: ctx.chat,
        user: user,
        message: ctx.update.message ?? null,
        reply: async (text: string, replyOptions?: ReplyOptions) => {
          await ctx.bot!.sendMessage(ctx.chat!.id, text, replyOptions);
          return {} as TelegramMessage;
        },
        replyWithWebApp: async (text: string, buttonText: string, url: string) => {
          await ctx.bot!.sendMessage(ctx.chat!.id, text, {
            reply_markup: {
              inline_keyboard: [[{ text: buttonText, web_app: { url } }]]
            }
          });
          return {} as TelegramMessage;
        },
        state: {},
        update: ctx.update
      },
      services: options.services as never,
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        horizontalAccuracy: location.horizontal_accuracy
      },
      sign
    });
  };
}

// Callback handler

interface CallbackHandlerOptions {
  actions: ReadonlyMap<string, ActionFlowActionDefinition>;
  flows: readonly DiscoveredFlowModule[];
  secret: string;
  services?: unknown;
  sessionManager: SessionManager;
}

function createActionCallbackHandler(
  options: CallbackHandlerOptions
): CallbackQueryHandler {
  return async (ctx) => {
    const data = ctx.update.callback_query?.data;
    if (!data) {
      return;
    }

    const verified = verifyActionCallback(data, options.secret);
    if (verified) {
      const key = `${verified.context.flowId}:${verified.actionId}`;
      const action = options.actions.get(key);
      if (!action) {
        return;
      }

      let session = undefined;
      if (action.requiresSession) {
        const handle = await options.sessionManager.get(
          verified.context.userId,
          verified.context.flowId,
          verified.context.userId
        );
        if (handle) {
          session = handle;
        }
      }

      await action.handler({ sign: async () => { throw new Error("sign not available in callback context"); },
        ctx: verified.context,
        data: {},
        services: options.services as never,
        session
      });
      return;
    }

    // Plain callback: dispatch to flow onCallback handlers
    for (const { flow } of options.flows) {
      if (flow.handlers?.onCallback) {
        const replyFn = async (text: string, replyOptions?: ReplyOptions) => {
          await ctx.bot?.sendMessage(ctx.chat?.id ?? 0, text, replyOptions);
          return {} as TelegramMessage;
        };
        const answerFn = async (text?: string) => {
          await ctx.bot?.answerCallbackQuery?.(ctx.update.callback_query?.id ?? "", text);
        };
        await flow.handlers.onCallback({
          ctx: {
            ...ctx,
            data,
            reply: replyFn,
            answer: answerFn
          },
          services: options.services as never
        });
        return;
      }
    }
  };
}

// WebApp data handler

interface WebAppDataHandlerOptions {
  actions: ReadonlyMap<string, ActionFlowActionDefinition>;
  flows: readonly DiscoveredFlowModule[];
  secret: string;
  services?: unknown;
  sessionManager: SessionManager;
}

function createWebAppDataHandler(
  options: WebAppDataHandlerOptions
): WebAppDataHandler {
  return async (ctx) => {
    const webAppData = ctx.update.message?.web_app_data;
    if (!webAppData) {
      return;
    }

    try {
      const parsed = JSON.parse(webAppData.data) as Record<string, unknown>;

      if (typeof parsed.signedContext === "string" && typeof parsed.actionId === "string") {
        const context = validateActionContext(parsed.signedContext, options.secret, {
          allowedAction: parsed.actionId as string
        });

        if (!context) {
          return;
        }

        const key = `${context.flowId}:${parsed.actionId}`;
        const action = options.actions.get(key);
        if (!action) {
          return;
        }

        let session = undefined;
        if (action.requiresSession) {
          const handle = await options.sessionManager.get(
            context.userId,
            context.flowId,
            context.userId
          );
          if (handle) {
            session = handle;
          }
        }

        await action.handler({ sign: async () => { throw new Error("sign not available in callback context"); },
          ctx: context,
          data: parsed.payload ?? {},
          services: options.services as never,
          session
        });
      }
    } catch {
      // ignore parse errors
    }
  };
}

// Helpers

function collectContactHandlers(
  flows: readonly DiscoveredFlowModule[]
): Map<string, NonNullable<ActionFlowDefinition["handlers"]>["onContact"]> {
  const handlers = new Map<
    string,
    NonNullable<ActionFlowDefinition["handlers"]>["onContact"]
  >();
  for (const { flow } of flows) {
    if (flow.handlers?.onContact) {
      if (handlers.size > 0) {
        throw new Error(
          "Multiple flows define onContact handlers. Only one global onContact handler is allowed."
        );
      }
      handlers.set(flow.id, flow.handlers.onContact);
    }
  }
  return handlers;
}

function collectLocationHandlers(
  flows: readonly DiscoveredFlowModule[]
): Map<string, NonNullable<ActionFlowDefinition["handlers"]>["onLocation"]> {
  const handlers = new Map<
    string,
    NonNullable<ActionFlowDefinition["handlers"]>["onLocation"]
  >();
  for (const { flow } of flows) {
    if (flow.handlers?.onLocation) {
      if (handlers.size > 0) {
        throw new Error(
          "Multiple flows define onLocation handlers. Only one global onLocation handler is allowed."
        );
      }
      handlers.set(flow.id, flow.handlers.onLocation);
    }
  }
  return handlers;
}

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  return value && value.length > 0 ? value : undefined;
}

interface TelegramApiBot extends BotInstance {
  setCommands(commands: Iterable<{ command: string; description?: string }>): Promise<void>;
}

interface PollingBot extends TelegramApiBot {
  getUpdates(offset?: number): Promise<TelegramUpdate[]>;
}

function createTeleforgePollingBot(token: string): PollingBot {
  const baseUrl = `https://api.telegram.org/bot${token}`;

  return {
    async getUpdates(offset) {
      const response = await callTelegramApi<TelegramUpdate[]>(baseUrl, "getUpdates", {
        allowed_updates: ["message", "callback_query"],
        offset,
        timeout: 25
      });
      return Array.isArray(response) ? response : [];
    },
    async sendMessage(chatId, text, options = {}) {
      return callTelegramApi<TelegramMessage>(baseUrl, "sendMessage", {
        chat_id: chatId,
        text,
        ...toTelegramSendOptions(options)
      });
    },
    async setCommands(commands) {
      await callTelegramApi(baseUrl, "setMyCommands", {
        commands: Array.from(commands, (c) => ({ command: c.command, description: c.description ?? c.command }))
      });
    }
  };
}

function createTeleforgeWebhookBot(token: string): TelegramApiBot {
  const baseUrl = `https://api.telegram.org/bot${token}`;

  return {
    async sendMessage(chatId, text, options = {}) {
      return callTelegramApi<TelegramMessage>(baseUrl, "sendMessage", {
        chat_id: chatId,
        text,
        ...toTelegramSendOptions(options)
      });
    },
    async setCommands(commands) {
      await callTelegramApi(baseUrl, "setMyCommands", {
        commands: Array.from(commands, (c) => ({ command: c.command, description: c.description ?? c.command }))
      });
    }
  };
}

function createPreviewBot(): BotInstance {
  let messageId = 0;
  return {
    async sendMessage(chatId, text, options = {}) {
      messageId += 1;
      console.log("[teleforge:bot:preview]", JSON.stringify({ chatId, text, options }, null, 2));
      return { chat: { id: chatId }, message_id: messageId, text } as TelegramMessage;
    }
  };
}

function callTelegramApi<T>(baseUrl: string, method: string, body: Record<string, unknown>): Promise<T> {
  const url = `${baseUrl}/${method}`;
  const payload = JSON.stringify(body);
  const target = new URL(url);
  const timeoutSeconds = typeof body.timeout === "number" ? body.timeout : 0;
  const timeoutMs = Math.max(10_000, (timeoutSeconds + 10) * 1_000);

  return new Promise<T>((resolve, reject) => {
    const req = https.request(
      {
        family: 4,
        headers: { "content-length": Buffer.byteLength(payload), "content-type": "application/json" },
        hostname: target.hostname,
        method: "POST",
        path: `${target.pathname}${target.search}`,
        port: target.port ? Number(target.port) : 443
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => { body += chunk; });
        response.on("end", () => {
          try {
            const parsed = JSON.parse(body) as { description?: string; ok: boolean; result: T };
            if (response.statusCode! < 200 || response.statusCode! >= 300 || !parsed.ok) {
              throw new Error(parsed.description ?? `Telegram API request failed (${response.statusCode}) while calling ${method}.`);
            }
            resolve(parsed.result);
          } catch (error) {
            reject(error instanceof Error ? error : new Error(`Telegram API ${method} returned unparseable response.`));
          }
        });
      }
    );
    req.setTimeout(timeoutMs, () => { req.destroy(new Error(`Telegram API request timed out after ${timeoutMs}ms.`)); });
    req.on("error", (error) => { reject(error); });
    req.write(payload);
    req.end();
  });
}

function toTelegramSendOptions(options: ReplyOptions): Record<string, unknown> {
  return {
    disable_web_page_preview: options.disable_web_page_preview,
    parse_mode: options.parse_mode,
    reply_markup: options.reply_markup ? { ...options.reply_markup } : undefined,
    reply_to_message_id: options.reply_to_message_id
  };
}
