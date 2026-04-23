import https from "node:https";

import {
  createDefaultReturnHandlers,
  createBotRuntime,
  createFlowCallback,
  createMiniAppButton,
  createPhoneAuthLink,
  createPhoneNumberRequestMarkup,
  createSignedPayload,
  extractSharedPhoneContact,
  extractFlowContext,
  handleMiniAppReturnData,
  handleFlowCallback,
  sendFlowInit
} from "@teleforgex/bot";
import { UserFlowStateManager, createFlowStorage } from "@teleforgex/core";

import { loadTeleforgeApp } from "./config.js";
import { createFlowCommands, loadTeleforgeFlowHandlers, loadTeleforgeFlows } from "./discovery.js";
import { getFlowStep, resolveFlowActionKey } from "./flow.js";

import type { CreateFlowCommandsOptions } from "./discovery.js";
import type { DiscoveredFlowModule, DiscoveredFlowStepHandlerModule } from "./discovery.js";
import type {
  ChatFlowStepDefinition,
  FlowActionDefinition,
  FlowTransitionResult,
  TeleforgeFlowDefinition
} from "./flow.js";
import type {
  BotCommandDefinition,
  BotInstance,
  BotRuntime,
  CallbackQueryHandler,
  CommandContext,
  Middleware,
  ReplyOptions,
  TelegramMessage,
  TelegramUpdate,
  WebAppDataHandler
} from "@teleforgex/bot";
import type { FlowInstance, TeleforgeAppConfig } from "@teleforgex/core";

const MAX_FLOW_TRANSITIONS = 12;
const MINI_APP_CHAT_HANDOFF_TYPE = "teleforge_flow_handoff";

export interface DiscoveredFlowRuntimeMiniAppDebugState {
  lastHandoffAt: string | null;
  lastLaunchAt: string | null;
  lastLaunchRoute: string | null;
  lastLaunchStepId: string | null;
  lastResumeAt: string | null;
  pendingChatHandoff: boolean;
  resumedStepId: string | null;
}

export interface DiscoveredFlowRuntimeSessionDebugState {
  chatId: string | null;
  currentRoute: string | null;
  currentScreenId: string | null;
  currentStepId: string;
  currentStepType: "chat" | "miniapp";
  flowId: string;
  lastTransition: {
    fromStepId: string | null;
    payload?: Record<string, unknown>;
    toStepId: string;
    transitionedAt: string;
    type: "step" | "action" | "submit" | "launch" | "handoff";
  } | null;
  lastUpdatedAt: string;
  miniApp: DiscoveredFlowRuntimeMiniAppDebugState;
  snapshotStateAvailable: boolean;
  stateKey: string;
  userId: string;
}

export interface DiscoveredFlowRuntimeDebugState {
  sessions: readonly DiscoveredFlowRuntimeSessionDebugState[];
  updatedAt: string | null;
}

export interface DiscoveredBotRuntime extends BotRuntime {
  getFlowRuntimeDebugState(): DiscoveredFlowRuntimeDebugState;
  getStorage(): UserFlowStateManager;
  handleChatHandoff(input: {
    flowContext: string;
    state: unknown;
    stateKey: string;
    stepId: string;
  }): Promise<void>;
}

export interface CreateDiscoveredBotRuntimeOptions {
  app?: TeleforgeAppConfig;
  commandOptions?: Omit<CreateFlowCommandsOptions, "flows" | "secret" | "storage" | "webAppUrl">;
  cwd?: string;
  flowSecret: string;
  miniAppUrl: string;
  phoneAuthSecret?: string;
  services?: unknown;
  storage?: UserFlowStateManager;
  storageTtlSeconds?: number;
}

export async function createDiscoveredBotRuntime(
  options: CreateDiscoveredBotRuntimeOptions
): Promise<DiscoveredBotRuntime> {
  const cwd = options.cwd ?? process.cwd();
  const app = options.app ?? (await loadTeleforgeApp(cwd)).app;
  const flows = await loadTeleforgeFlows({
    app,
    cwd
  });
  const handlers = await loadTeleforgeFlowHandlers({
    app,
    cwd
  });
  const runtime = createBotRuntime();
  let boundBot: Pick<BotInstance, "sendMessage"> | null = null;
  const originalBindBot = runtime.bindBot;
  runtime.bindBot = (bot) => {
    boundBot = bot;
    originalBindBot(bot);
  };
  const debugTracker = createFlowRuntimeDebugTracker();
  const miniAppEntryFlows = flows.filter(({ flow }) => isMiniAppEntryFlow(flow));
  const storage =
    options.storage ??
    new UserFlowStateManager(
      createFlowStorage({
        backend: "memory",
        defaultTTL: options.storageTtlSeconds ?? 900,
        namespace: app.app.id
      })
    );
  runtime.registerCommands(
    createTrackedMiniAppEntryCommands({
      commands: createFlowCommands({
        ...(options.commandOptions ?? {}),
        flows: miniAppEntryFlows,
        secret: options.flowSecret,
        storage,
        webAppUrl: options.miniAppUrl
      }),
      debugTracker,
      flows: miniAppEntryFlows,
      storage
    })
  );
  runtime.registerCommands(
    createChatEntryCommands({
      debugTracker,
      flows: flows.filter(({ flow }) => !isMiniAppEntryFlow(flow)),
      handlers,
      miniAppUrl: options.miniAppUrl,
      phoneAuthSecret: options.phoneAuthSecret,
      secret: options.flowSecret,
      services: options.services,
      storage
    })
  );
  runtime.router.use(
    createDiscoveredFlowPhoneContactMiddleware({
      debugTracker,
      flows,
      handlers,
      miniAppUrl: options.miniAppUrl,
      phoneAuthSecret: options.phoneAuthSecret,
      secret: options.flowSecret,
      services: options.services,
      storage
    })
  );
  runtime.router.onCallbackQuery(
    createDiscoveredFlowCallbackHandler({
      debugTracker,
      flows,
      handlers,
      miniAppUrl: options.miniAppUrl,
      phoneAuthSecret: options.phoneAuthSecret,
      secret: options.flowSecret,
      services: options.services,
      storage
    })
  );
  runtime.router.onWebAppData(
    createDiscoveredFlowWebAppDataHandler({
      debugTracker,
      flows,
      handlers,
      miniAppUrl: options.miniAppUrl,
      secret: options.flowSecret,
      services: options.services,
      storage
    })
  );

  const discoveredRuntime = runtime as DiscoveredBotRuntime;
  discoveredRuntime.getFlowRuntimeDebugState = () => debugTracker.snapshot();
  discoveredRuntime.getStorage = () => storage;
  discoveredRuntime.handleChatHandoff = async (input) => {
    const flowContext = extractFlowContext(input.flowContext, options.flowSecret);

    if (!flowContext || flowContext.payload.stateKey !== input.stateKey) {
      throw new Error("Could not verify chat handoff flow context.");
    }

    const persisted = await storage.getInstance(input.stateKey);

    if (!persisted) {
      throw new Error("Flow state expired before chat handoff.");
    }

    const flow = flows.find(({ flow: f }) => f.id === persisted.flowId)?.flow;

    if (!flow) {
      throw new Error(`Unknown flow "${persisted.flowId}" in chat handoff.`);
    }

    console.log("[teleforge:bot-runtime] chat handoff:", {
      chatId: persisted.chatId,
      flowId: persisted.flowId,
      persistedState: JSON.stringify(persisted.state),
      persistedStepId: persisted.stepId,
      targetStepId: input.stepId,
      incomingState: JSON.stringify(input.state)
    });

    const handlerIndex = createHandlerIndex(handlers);
    await storage.advanceStep(
      input.stateKey,
      input.stepId,
      cloneFlowState(input.state) as Record<string, unknown>,
      "chat"
    );
    debugTracker.trackTransition({
      flow,
      fromStepId: persisted.stepId,
      stateKey: input.stateKey,
      stepId: input.stepId,
      type: "handoff"
    });
    debugTracker.trackMiniAppHandoff({
      chatId: String(persisted.chatId ?? ""),
      flow,
      snapshotStateAvailable: true,
      stateKey: input.stateKey,
      stepId: input.stepId
    });

    const chatId = persisted.chatId;

    if (!chatId) {
      throw new Error("Chat ID unavailable for chat handoff.");
    }

    if (!boundBot) {
      throw new Error("Bot instance unavailable for chat handoff. Call bindBot() first.");
    }

    console.log("[teleforge:bot-runtime] entering flow step:", {
      chatId,
      flowId: flow.id,
      stepId: input.stepId
    });

    await enterDiscoveredFlowStep(
      {
        chatId,
        debugTracker,
        flow,
        handlers,
        miniAppUrl: options.miniAppUrl,
        secret: options.flowSecret,
        services: options.services,
        state: cloneFlowState(input.state),
        stateKey: input.stateKey,
        storage
      },
      {
        bot: boundBot,
        handlerIndex
      }
    );
  };

  return discoveredRuntime;
}

interface CreateChatEntryCommandsOptions {
  debugTracker: FlowRuntimeDebugTracker;
  flows: readonly DiscoveredFlowModule[];
  handlers: readonly DiscoveredFlowStepHandlerModule[];
  miniAppUrl: string;
  phoneAuthSecret?: string;
  secret: string;
  services?: unknown;
  storage: UserFlowStateManager;
}

interface CreateDiscoveredFlowCallbackHandlerOptions {
  debugTracker: FlowRuntimeDebugTracker;
  flows: readonly DiscoveredFlowModule[];
  handlers: readonly DiscoveredFlowStepHandlerModule[];
  miniAppUrl: string;
  phoneAuthSecret?: string;
  secret: string;
  services?: unknown;
  storage: UserFlowStateManager;
}

interface CreateDiscoveredFlowWebAppDataHandlerOptions extends CreateDiscoveredFlowCallbackHandlerOptions {}

interface PendingPhoneAction {
  action: FlowActionDefinition<unknown, unknown>;
  flow: TeleforgeFlowDefinition<unknown, unknown>;
  persisted: FlowInstance;
  stateKey: string;
  step: ChatFlowStepDefinition<unknown, unknown>;
  stepId: string;
}

interface MiniAppChatHandoffPayload {
  flowContext: string;
  state: unknown;
  stateKey: string;
  stepId: string;
  type: typeof MINI_APP_CHAT_HANDOFF_TYPE;
}

interface CreateTrackedMiniAppEntryCommandsOptions {
  commands: readonly BotCommandDefinition[];
  debugTracker: FlowRuntimeDebugTracker;
  flows: readonly DiscoveredFlowModule[];
  storage: UserFlowStateManager;
}

function createTrackedMiniAppEntryCommands(
  options: CreateTrackedMiniAppEntryCommandsOptions
): BotCommandDefinition[] {
  const miniAppFlowsByCommand = new Map<string, TeleforgeFlowDefinition<unknown, unknown>>();

  for (const { flow } of options.flows) {
    const command = flow.bot?.command?.command;
    if (command) {
      miniAppFlowsByCommand.set(command, flow);
    }
  }

  return options.commands.map((command) => {
    const flow = miniAppFlowsByCommand.get(command.command);

    if (!flow) {
      return command;
    }

    const entryStepId = String(flow.bot?.command?.entryStep ?? flow.initialStep);

    return {
      ...command,
      async handler(context) {
        await command.handler(context);
        const stateKey = options.storage.createStateKey(String(context.user.id), flow.id);
        options.debugTracker.trackMiniAppLaunch({
          chatId: String(context.chat.id),
          flow,
          snapshotStateAvailable: true,
          stateKey,
          stepId: entryStepId,
          userId: String(context.user.id)
        });
        options.debugTracker.trackTransition({
          flow,
          stateKey,
          stepId: entryStepId,
          type: "launch"
        });
      }
    };
  });
}

function createChatEntryCommands(options: CreateChatEntryCommandsOptions): BotCommandDefinition[] {
  return options.flows.flatMap(({ flow }) => {
    const command = flow.bot?.command;

    if (!command) {
      return [];
    }

    const entryStep = String(command.entryStep ?? flow.initialStep);
    const step = getFlowStep(flow, entryStep);

    if (step.type !== "chat") {
      return [];
    }

    return [
      {
        command: command.command,
        description: command.description,
        async handler(context) {
          const initialState = cloneFlowState(flow.state);
          const userId = String(context.user.id);
          const { key: stateKey } = await options.storage.startInstance(
            String(context.user.id),
            flow.id,
            flow.initialStep,
            initialState as Record<string, unknown>,
            String(context.chat.id)
          );
          options.debugTracker.trackStep({
            chatId: String(context.chat.id),
            flow,
            snapshotStateAvailable: true,
            stateKey,
            stepId: entryStep,
            userId
          });

          await enterDiscoveredFlowStep(
            {
              chatId: context.chat.id,
              debugTracker: options.debugTracker,
              flow,
              handlers: options.handlers,
              miniAppUrl: options.miniAppUrl,
              secret: options.secret,
              services: options.services,
              state: initialState,
              stateKey,
              storage: options.storage
            },
            {
              bot: requireBoundBot(context.bot, flow.id)
            }
          );
        }
      }
    ];
  });
}

function createDiscoveredFlowCallbackHandler(
  options: CreateDiscoveredFlowCallbackHandlerOptions
): CallbackQueryHandler {
  const flows = new Map(options.flows.map(({ flow }) => [flow.id, flow]));
  const handlerIndex = createHandlerIndex(options.handlers);

  return async (context) => {
    const callback = handleFlowCallback(context.update, options.secret);

    if (!callback) {
      await context.answer();
      return;
    }

    const flow = flows.get(callback.flowId);

    if (!flow) {
      await context.answer("Unknown flow.");
      return;
    }

    const persisted = await options.storage.resumeFlow(String(context.user.id), flow.id);

    if (!persisted) {
      await context.answer("Flow expired.");
      return;
    }

    const stepId = String(persisted.stepId);
    const step = getFlowStep(flow, stepId);

    if (step.type !== "chat") {
      await context.answer("This step is not interactive in chat.");
      return;
    }

    const action = (step.actions ?? []).find(
      (candidate) => resolveFlowActionKey(candidate) === callback.action
    );

    if (!action) {
      await context.answer("Action unavailable.");
      return;
    }

    const currentState = readPersistedFlowState(flow, persisted);
    const handlerModule = handlerIndex.get(`${flow.id}:${stepId}`);
    const actionHandler =
      action.handler ?? handlerModule?.actions[resolveFlowActionKey(action)] ?? undefined;

    if (!actionHandler && !action.to) {
      await context.answer("Action is not wired yet.");
      return;
    }

    const result = actionHandler
      ? await actionHandler({
          flow,
          services: options.services,
          state: currentState
        })
      : undefined;
    const nextState = resolveNextState(currentState, result);
    const nextStepId = resolveNextStepId(stepId, action, result);
    const stateKey = options.storage.createStateKey(String(context.user.id), flow.id);
    const chatId = context.chat?.id ?? context.message?.chat.id;

    if (chatId === undefined || chatId === null) {
      await context.answer("Chat unavailable.");
      return;
    }

    await options.storage.advanceStep(stateKey, nextStepId, nextState as Record<string, unknown>);
    options.debugTracker.trackTransition({
      flow,
      fromStepId: stepId,
      payload: result && typeof result === "object" && "state" in result ? { stateSnapshot: true } : undefined,
      stateKey,
      stepId: nextStepId,
      type: "action"
    });
    options.debugTracker.trackStep({
      chatId: String(chatId),
      flow,
      snapshotStateAvailable: true,
      stateKey,
      stepId: nextStepId,
      userId: String(context.user.id)
    });
    await context.answer();
    await enterDiscoveredFlowStep(
      {
        chatId,
        debugTracker: options.debugTracker,
        flow,
        handlers: options.handlers,
        miniAppUrl: options.miniAppUrl,
        secret: options.secret,
        services: options.services,
        state: nextState,
        stateKey,
        storage: options.storage
      },
      {
        bot: requireBoundBot(context.bot, flow.id),
        handlerIndex
      }
    );
  };
}

function createDiscoveredFlowPhoneContactMiddleware(
  options: CreateDiscoveredFlowCallbackHandlerOptions
): Middleware {
  const handlerIndex = createHandlerIndex(options.handlers);

  return async (context, next) => {
    if (!context.message?.contact) {
      await next();
      return;
    }

    if (!context.user || !context.chat) {
      await context.reply("Could not verify the shared phone number sender.");
      return;
    }

    const pending = await findPendingPhoneAction(
      options.flows.map(({ flow }) => flow),
      options.storage,
      String(context.user.id)
    );

    if (!pending) {
      await next();
      return;
    }

    const sharedContact = extractSharedPhoneContact(context.update);

    if (!sharedContact) {
      await context.reply("Please share your own Telegram contact using the phone button.");
      return;
    }

    const currentState = readPersistedFlowState(pending.flow, pending.persisted);
    const actionHandler =
      pending.action.handler ??
      handlerIndex.get(`${pending.flow.id}:${pending.stepId}`)?.actions[
        resolveFlowActionKey(pending.action)
      ] ??
      undefined;
    const phone = {
      normalizedPhoneNumber: sharedContact.normalizedPhoneNumber,
      phoneNumber: sharedContact.phoneNumber,
      telegramUserId: sharedContact.telegramUserId
    };
    const stateWithPhone = applyPhoneToState(
      currentState,
      pending.action,
      phone.normalizedPhoneNumber,
      phone.phoneNumber
    );
    const result = actionHandler
      ? await actionHandler({
          flow: pending.flow,
          phone,
          services: options.services,
          state: stateWithPhone
        })
      : undefined;
    const nextState = resolveNextState(stateWithPhone, result);
    const nextStepId = resolveNextStepId(pending.stepId, pending.action, result);
    const miniAppUrl = await resolveMiniAppUrlForPhoneRequest(
      options.miniAppUrl,
      pending.action,
      options.phoneAuthSecret ?? options.secret,
      phone
    );

    await options.storage.advanceStep(
      pending.stateKey,
      nextStepId,
      nextState as Record<string, unknown>
    );
    options.debugTracker.trackTransition({
      flow: pending.flow,
      fromStepId: pending.stepId,
      payload: { phoneNumber: phone.normalizedPhoneNumber },
      stateKey: pending.stateKey,
      stepId: nextStepId,
      type: "action"
    });
    options.debugTracker.trackStep({
      chatId: String(context.chat.id),
      flow: pending.flow,
      snapshotStateAvailable: true,
      stateKey: pending.stateKey,
      stepId: nextStepId,
      userId: String(context.user.id)
    });

    await enterDiscoveredFlowStep(
      {
        chatId: context.chat.id,
        debugTracker: options.debugTracker,
        flow: pending.flow,
        handlers: options.handlers,
        miniAppUrl,
        secret: options.secret,
        services: options.services,
        state: nextState,
        stateKey: pending.stateKey,
        storage: options.storage
      },
      {
        bot: requireBoundBot(context.bot, pending.flow.id),
        handlerIndex
      }
    );
  };
}

function createDiscoveredFlowWebAppDataHandler(
  options: CreateDiscoveredFlowWebAppDataHandlerOptions
): WebAppDataHandler {
  const flows = new Map(options.flows.map(({ flow }) => [flow.id, flow]));
  const handlerIndex = createHandlerIndex(options.handlers);

  return async (context) => {
    const handoff = parseMiniAppChatHandoffPayload(context.payload);

    if (handoff) {
      const flowContext = extractFlowContext(handoff.flowContext, options.secret);

      if (!flowContext || flowContext.payload.stateKey !== handoff.stateKey) {
        await context.answer("Could not verify Mini App handoff payload");
        return;
      }

      const flow = flows.get(flowContext.flowId);

      if (!flow) {
        await context.answer("Unknown flow.");
        return;
      }

      const persisted = await options.storage.getInstance(handoff.stateKey);

      if (!persisted) {
        await context.answer("Flow expired before chat handoff");
        return;
      }

      await options.storage.advanceStep(
        handoff.stateKey,
        handoff.stepId,
        cloneFlowState(handoff.state) as Record<string, unknown>
      );
      options.debugTracker.trackMiniAppHandoff({
        chatId: String(persisted.chatId ?? context.chat.id),
        flow,
        snapshotStateAvailable: true,
        stateKey: handoff.stateKey,
        stepId: handoff.stepId,
        userId: String(context.user?.id ?? persisted.userId)
      });

      await context.answer("Returned to chat");
      await enterDiscoveredFlowStep(
        {
          chatId: persisted.chatId ?? context.chat.id,
          debugTracker: options.debugTracker,
          flow,
          handlers: options.handlers,
          miniAppUrl: options.miniAppUrl,
          secret: options.secret,
          services: options.services,
          state: cloneFlowState(handoff.state),
          stateKey: handoff.stateKey,
          storage: options.storage
        },
        {
          bot: requireBoundBot(context.bot, flow.id),
          handlerIndex
        }
      );
      return;
    }

    const handled = await handleMiniAppReturnData(
      context,
      options.storage,
      options.secret,
      createDefaultReturnHandlers(context)
    );

    if (handled) {
      return;
    }

    await context.answer("Received Mini App data");
  };
}

async function enterDiscoveredFlowStep(
  options: {
    chatId: number | string;
    debugTracker: FlowRuntimeDebugTracker;
    flow: TeleforgeFlowDefinition<unknown, unknown>;
    handlers: readonly DiscoveredFlowStepHandlerModule[];
    miniAppUrl?: string | null;
    secret: string;
    services?: unknown;
    state: unknown;
    stateKey: string;
    storage: UserFlowStateManager;
  },
  runtime: {
    bot: Pick<BotInstance, "sendMessage">;
    handlerIndex?: ReadonlyMap<string, DiscoveredFlowStepHandlerModule>;
  }
): Promise<void> {
  const handlerIndex = runtime.handlerIndex ?? createHandlerIndex(options.handlers);
  let currentState = cloneFlowState(options.state);
  let currentStepId = String(
    (await options.storage.getInstance(options.stateKey))?.stepId ?? options.flow.initialStep
  );
  const chatId = String(options.chatId);

  for (let iteration = 0; iteration < MAX_FLOW_TRANSITIONS; iteration += 1) {
    const step = getFlowStep(options.flow, currentStepId);
    const handlerModule = handlerIndex.get(`${options.flow.id}:${currentStepId}`);
    const onEnter = step.onEnter ?? handlerModule?.onEnter;

    if (onEnter) {
      const result = await onEnter({
        flow: options.flow,
        services: options.services,
        state: currentState
      });

      currentState = resolveNextState(currentState, result);
      const previousStepId = currentStepId;

      const redirectedStepId =
        isFlowTransitionResult(result) && typeof result.to === "string" && result.to.length > 0
          ? result.to
          : currentStepId;

      await options.storage.advanceStep(
        options.stateKey,
        redirectedStepId,
        currentState as Record<string, unknown>
      );
      currentStepId = redirectedStepId;
      options.debugTracker.trackTransition({
        flow: options.flow,
        fromStepId: previousStepId,
        payload: result && typeof result === "object" && "state" in result ? { stateSnapshot: true } : undefined,
        stateKey: options.stateKey,
        stepId: redirectedStepId,
        type: "submit"
      });
      options.debugTracker.trackStep({
        chatId,
        flow: options.flow,
        snapshotStateAvailable: true,
        stateKey: options.stateKey,
        stepId: redirectedStepId
      });

      if (redirectedStepId !== previousStepId) {
        continue;
      }
    }

    if (step.type === "chat") {
      options.debugTracker.trackStep({
        chatId,
        flow: options.flow,
        snapshotStateAvailable: true,
        stateKey: options.stateKey,
        stepId: currentStepId
      });
      await options.storage.advanceStep(
        options.stateKey,
        currentStepId,
        currentState as Record<string, unknown>
      );
      await sendChatStepMessage(
        runtime.bot,
        options.flow,
        step,
        currentState,
        options.secret,
        options.chatId,
        options.miniAppUrl ?? null,
        options.stateKey
      );
      return;
    }

    if (!options.miniAppUrl) {
      throw new Error(
        `Flow "${options.flow.id}" step "${currentStepId}" requires a Mini App URL to continue.`
      );
    }

    options.debugTracker.trackMiniAppLaunch({
      chatId,
      flow: options.flow,
      snapshotStateAvailable: true,
      stateKey: options.stateKey,
      stepId: currentStepId
    });
    await sendFlowInit(runtime.bot, {
      buttonText: options.flow.bot?.command?.buttonText,
      chatId: options.chatId,
      flowId: options.flow.id,
      payload: {
        stateKey: options.stateKey
      },
      requestWriteAccess: options.flow.miniApp?.requestWriteAccess,
      returnText: options.flow.miniApp?.returnToChat?.text,
      secret: options.secret,
      stayInChat: options.flow.miniApp?.returnToChat?.stayInChat,
      stepId: currentStepId,
      text: options.flow.bot?.command?.text ?? "Continue in the Mini App",
      webAppUrl: options.miniAppUrl
    });
    return;
  }

  throw new Error(`Flow "${options.flow.id}" exceeded the maximum transition depth.`);
}

async function resolveMiniAppUrlForPhoneRequest(
  baseMiniAppUrl: string | null | undefined,
  action: FlowActionDefinition<unknown, unknown>,
  secret: string,
  phone: {
    normalizedPhoneNumber: string;
    telegramUserId: number;
  }
): Promise<string | null> {
  if (!baseMiniAppUrl) {
    return null;
  }

  if (!action.phoneRequest?.auth) {
    return baseMiniAppUrl;
  }

  return createPhoneAuthLink({
    phoneNumber: phone.normalizedPhoneNumber,
    secret,
    telegramUserId: phone.telegramUserId,
    webAppUrl: baseMiniAppUrl
  });
}

async function sendChatStepMessage(
  bot: Pick<BotInstance, "sendMessage">,
  flow: TeleforgeFlowDefinition<unknown, unknown>,
  step: ChatFlowStepDefinition<unknown, unknown>,
  state: unknown,
  secret: string,
  chatId: number | string,
  miniAppUrl: string | null,
  stateKey: string
): Promise<void> {
  const text = typeof step.message === "function" ? step.message({ state }) : step.message;
  const phoneAction = (step.actions ?? []).find((action) => action.phoneRequest);

  if (phoneAction) {
    await bot.sendMessage(chatId, text, {
      reply_markup: createPhoneNumberRequestMarkup({
        text: phoneAction.label
      })
    });
    return;
  }

  const buttons = (step.actions ?? []).map((action) => [
    action.miniApp && miniAppUrl
      ? createMiniAppButton({
          requestWriteAccess: flow.miniApp?.requestWriteAccess,
          startPayload: createSignedPayload(
            {
              flowId: flow.id,
              payload: {
                ...action.miniApp.payload,
                route:
                  resolveFlowStepRoute(flow, action.to ?? (flow.initialStep as string)) ??
                  undefined,
                stateKey
              },
              requestWriteAccess: flow.miniApp?.requestWriteAccess ?? false,
              stayInChat: flow.miniApp?.returnToChat?.stayInChat ?? false,
              stepId: action.to
            },
            secret
          ),
          stayInChat: flow.miniApp?.returnToChat?.stayInChat,
          text: action.label,
          webAppUrl: miniAppUrl
        })
      : createFlowCallback(
          {
            action: resolveFlowActionKey(action),
            flowId: flow.id,
            text: action.label
          },
          secret
        )
  ]);

  console.log("[teleforge:bot-runtime] sendChatStepMessage:", {
    chatId,
    flowId: flow.id,
    state: JSON.stringify(state),
    text: text.substring(0, 100),
    buttonCount: buttons.length
  });

  await bot.sendMessage(chatId, text, {
    ...(buttons.length > 0
      ? {
          reply_markup: {
            inline_keyboard: buttons
          }
        }
      : {})
  });
}

async function findPendingPhoneAction(
  flows: readonly TeleforgeFlowDefinition<unknown, unknown>[],
  storage: UserFlowStateManager,
  userId: string
): Promise<PendingPhoneAction | null> {
  for (const flow of flows) {
    const persisted = await storage.resumeFlow(userId, flow.id);

    if (!persisted) {
      continue;
    }

    const stateKey = storage.createStateKey(userId, flow.id);
    const stepId = String(persisted.stepId);
    const step = getFlowStep(flow, stepId);

    if (step.type !== "chat") {
      continue;
    }

    const action = (step.actions ?? []).find((candidate) => candidate.phoneRequest);

    if (!action) {
      continue;
    }

    return {
      action,
      flow,
      persisted,
      stateKey,
      step,
      stepId
    };
  }

  return null;
}

function applyPhoneToState(
  state: unknown,
  action: FlowActionDefinition<unknown, unknown>,
  normalizedPhoneNumber: string,
  rawPhoneNumber: string
): unknown {
  const phoneRequest = action.phoneRequest;

  if (!phoneRequest) {
    return state;
  }

  const nextState =
    state && typeof state === "object" && !Array.isArray(state)
      ? { ...(state as Record<string, unknown>) }
      : {};
  const stateField = phoneRequest.stateField ?? "phoneNumber";

  nextState[stateField] = normalizedPhoneNumber;

  if (phoneRequest.rawStateField) {
    nextState[phoneRequest.rawStateField] = rawPhoneNumber;
  }

  return nextState;
}

function isMiniAppEntryFlow(flow: TeleforgeFlowDefinition<unknown, unknown>): boolean {
  const entryStepId = String(flow.bot?.command?.entryStep ?? flow.initialStep);
  return getFlowStep(flow, entryStepId).type === "miniapp";
}

function createHandlerIndex(
  handlers: readonly DiscoveredFlowStepHandlerModule[]
): ReadonlyMap<string, DiscoveredFlowStepHandlerModule> {
  return new Map(handlers.map((handler) => [`${handler.flowId}:${handler.stepId}`, handler]));
}

interface FlowRuntimeDebugTracker {
  snapshot(): DiscoveredFlowRuntimeDebugState;
  trackMiniAppHandoff(input: FlowRuntimeDebugEventInput): void;
  trackMiniAppLaunch(input: FlowRuntimeDebugEventInput): void;
  trackStep(input: FlowRuntimeDebugEventInput): void;
  trackTransition(input: FlowRuntimeDebugTransitionInput): void;
}

interface FlowRuntimeDebugEventInput {
  chatId?: string;
  flow: TeleforgeFlowDefinition<unknown, unknown>;
  snapshotStateAvailable: boolean;
  stateKey: string;
  stepId: string;
  userId?: string;
}

interface FlowRuntimeDebugTransitionInput {
  flow: TeleforgeFlowDefinition<unknown, unknown>;
  fromStepId?: string;
  payload?: Record<string, unknown>;
  stateKey: string;
  stepId: string;
  type: "step" | "action" | "submit" | "launch" | "handoff";
}

interface MutableDiscoveredFlowRuntimeSessionDebugState extends DiscoveredFlowRuntimeSessionDebugState {
  miniApp: DiscoveredFlowRuntimeMiniAppDebugState;
}

function createFlowRuntimeDebugTracker(): FlowRuntimeDebugTracker {
  const sessions = new Map<string, MutableDiscoveredFlowRuntimeSessionDebugState>();
  let updatedAt: string | null = null;

  function resolveScreenId(
    flow: TeleforgeFlowDefinition<unknown, unknown>,
    stepId: string
  ): string | null {
    const step = getFlowStep(flow, stepId);
    return step.type === "miniapp" ? step.screen : null;
  }

  function ensureSession(
    input: FlowRuntimeDebugEventInput
  ): MutableDiscoveredFlowRuntimeSessionDebugState {
    const existing = sessions.get(input.stateKey);

    if (existing) {
      if (input.userId) {
        existing.userId = input.userId;
      }

      if (input.chatId) {
        existing.chatId = input.chatId;
      }

      return existing;
    }

    const step = getFlowStep(input.flow, input.stepId);
    const route = resolveFlowStepRoute(input.flow, input.stepId);
    const now = new Date().toISOString();
    const created: MutableDiscoveredFlowRuntimeSessionDebugState = {
      chatId: input.chatId ?? null,
      currentRoute: step.type === "miniapp" ? route : null,
      currentScreenId: resolveScreenId(input.flow, input.stepId),
      currentStepId: input.stepId,
      currentStepType: step.type,
      flowId: input.flow.id,
      lastTransition: null,
      lastUpdatedAt: now,
      miniApp: {
        lastHandoffAt: null,
        lastLaunchAt: null,
        lastLaunchRoute: null,
        lastLaunchStepId: null,
        lastResumeAt: null,
        pendingChatHandoff: false,
        resumedStepId: null
      },
      snapshotStateAvailable: input.snapshotStateAvailable,
      stateKey: input.stateKey,
      userId: input.userId ?? "unknown"
    };
    sessions.set(input.stateKey, created);
    updatedAt = now;
    return created;
  }

  function touch(session: MutableDiscoveredFlowRuntimeSessionDebugState): void {
    const now = new Date().toISOString();
    session.lastUpdatedAt = now;
    updatedAt = now;
  }

  function updateSessionStep(
    session: MutableDiscoveredFlowRuntimeSessionDebugState,
    flow: TeleforgeFlowDefinition<unknown, unknown>,
    stepId: string
  ): void {
    const step = getFlowStep(flow, stepId);
    session.currentStepId = stepId;
    session.currentStepType = step.type;
    session.currentRoute = step.type === "miniapp" ? resolveFlowStepRoute(flow, stepId) : null;
    session.currentScreenId = resolveScreenId(flow, stepId);
  }

  return {
    snapshot() {
      return {
        sessions: Object.freeze(
          [...sessions.values()]
            .map((session) =>
              Object.freeze({
                ...session,
                miniApp: Object.freeze({ ...session.miniApp })
              })
            )
            .sort((left, right) =>
              `${left.flowId}:${left.stateKey}`.localeCompare(`${right.flowId}:${right.stateKey}`)
            )
        ),
        updatedAt
      };
    },
    trackMiniAppHandoff(input) {
      const session = ensureSession(input);
      updateSessionStep(session, input.flow, input.stepId);
      session.snapshotStateAvailable =
        session.snapshotStateAvailable || input.snapshotStateAvailable;
      session.miniApp.lastHandoffAt = new Date().toISOString();
      session.miniApp.lastResumeAt = session.miniApp.lastHandoffAt;
      session.miniApp.pendingChatHandoff = false;
      session.miniApp.resumedStepId = input.stepId;
      touch(session);
    },
    trackMiniAppLaunch(input) {
      const session = ensureSession(input);
      const route = resolveFlowStepRoute(input.flow, input.stepId);
      updateSessionStep(session, input.flow, input.stepId);
      session.snapshotStateAvailable =
        session.snapshotStateAvailable || input.snapshotStateAvailable;
      session.miniApp.lastLaunchAt = new Date().toISOString();
      session.miniApp.lastLaunchRoute = route;
      session.miniApp.lastLaunchStepId = input.stepId;
      session.miniApp.pendingChatHandoff = true;
      touch(session);
    },
    trackStep(input) {
      const session = ensureSession(input);
      updateSessionStep(session, input.flow, input.stepId);
      session.snapshotStateAvailable =
        session.snapshotStateAvailable || input.snapshotStateAvailable;

      if (session.currentStepType === "chat") {
        session.miniApp.pendingChatHandoff = false;
      }

      touch(session);
    },
    trackTransition(input) {
      const session = sessions.get(input.stateKey);
      if (!session) {
        return;
      }

      const fromStepId = input.fromStepId ?? session.currentStepId;
      updateSessionStep(session, input.flow, input.stepId);
      session.lastTransition = {
        fromStepId,
        payload: input.payload,
        toStepId: input.stepId,
        transitionedAt: new Date().toISOString(),
        type: input.type
      };
      touch(session);
    }
  };
}

function resolveFlowStepRoute(
  flow: TeleforgeFlowDefinition<unknown, unknown>,
  stepId: string
): string | null {
  return flow.miniApp?.stepRoutes?.[stepId] ?? flow.miniApp?.route ?? null;
}

function parseMiniAppChatHandoffPayload(payload: unknown): MiniAppChatHandoffPayload | null {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("type" in payload) ||
    payload.type !== MINI_APP_CHAT_HANDOFF_TYPE ||
    !("flowContext" in payload) ||
    typeof payload.flowContext !== "string" ||
    !("stateKey" in payload) ||
    typeof payload.stateKey !== "string" ||
    !("stepId" in payload) ||
    typeof payload.stepId !== "string"
  ) {
    return null;
  }

  return {
    flowContext: payload.flowContext,
    state: "state" in payload ? payload.state : undefined,
    stateKey: payload.stateKey,
    stepId: payload.stepId,
    type: MINI_APP_CHAT_HANDOFF_TYPE
  };
}

function readPersistedFlowState(
  flow: TeleforgeFlowDefinition<unknown, unknown>,
  instance: FlowInstance
): unknown {
  return instance.state && Object.keys(instance.state).length > 0
    ? cloneFlowState(instance.state)
    : cloneFlowState(flow.state);
}

function cloneFlowState<T>(state: T): T {
  return structuredClone(state);
}

function resolveNextState<TState>(
  currentState: TState,
  result: void | FlowTransitionResult<TState> | unknown
): TState {
  if (isFlowTransitionResult(result) && result.state !== undefined) {
    return result.state as TState;
  }

  return currentState;
}

function resolveNextStepId<TState>(
  currentStepId: string,
  action: FlowActionDefinition<TState, unknown>,
  result: void | FlowTransitionResult<TState> | unknown
): string {
  if (isFlowTransitionResult(result) && typeof result.to === "string") {
    return result.to;
  }

  return action.to ?? currentStepId;
}

function requireBoundBot(
  bot: CommandContext["bot"],
  flowId: string
): Pick<BotInstance, "sendMessage"> {
  if (!bot) {
    throw new Error(`Flow "${flowId}" requires an attached bot instance.`);
  }

  return bot;
}

function isFlowTransitionResult<TState>(value: unknown): value is FlowTransitionResult<TState> {
  return typeof value === "object" && value !== null;
}

/* ───────────────────── High-level bootstrap API ───────────────────── */

export interface StartTeleforgeBotOptions {
  commandOptions?: Omit<CreateFlowCommandsOptions, "flows" | "secret" | "storage" | "webAppUrl">;
  cwd?: string;
  flowSecret?: string;
  miniAppUrl?: string;
  phoneAuthSecret?: string;
  services?: unknown;
  storage?: UserFlowStateManager;
  storageTtlSeconds?: number;
  /**
   * Override the bot instance used for delivery. When omitted, the framework
   * creates a polling bot for live Telegram or a preview bot when no token is
   * configured.
   */
  bot?: BotInstance;
  /**
   * When true and running in preview mode (no bot token), the framework
   * immediately drives a synthetic /start update to seed a session. Defaults
   * to false so preview boot stays passive.
   */
  previewStart?: boolean;
}

export interface StartTeleforgeBotResult {
  runtime: DiscoveredBotRuntime;
  stop: () => void;
}

/**
 * High-level bot bootstrap that loads config, resolves environment, creates the
 * discovered runtime, and starts polling or preview mode automatically.
 *
 * This wraps {@link createDiscoveredBotRuntime} and keeps it available as the
 * lower-level escape hatch for advanced use cases.
 */
export async function startTeleforgeBot(
  options: StartTeleforgeBotOptions = {}
): Promise<StartTeleforgeBotResult> {
  const cwd = options.cwd ?? process.cwd();
  const app = (await loadTeleforgeApp(cwd)).app;

  const tokenEnv = app.bot.tokenEnv;
  const token = readEnv(tokenEnv);

  // Preview-mode defaults are acceptable only when there is no live token.
  // In live mode, required runtime inputs must come from explicit options or
  // environment variables so the bootstrap contract is clear and safe.
  const rawFlowSecret = options.flowSecret ?? readEnv("TELEFORGE_FLOW_SECRET");
  const rawMiniAppUrl = options.miniAppUrl ?? readEnv("MINI_APP_URL");

  if (token) {
    if (!rawFlowSecret) {
      throw new Error(
        `startTeleforgeBot requires TELEFORGE_FLOW_SECRET (or options.flowSecret) when ${tokenEnv} is configured.`
      );
    }
    if (!rawMiniAppUrl) {
      throw new Error(
        `startTeleforgeBot requires MINI_APP_URL (or options.miniAppUrl) when ${tokenEnv} is configured.`
      );
    }
  }

  const flowSecret = rawFlowSecret ?? `${app.app.id}-preview-secret`;
  const miniAppUrl = rawMiniAppUrl ?? "https://example.ngrok.app";
  const phoneAuthSecret = options.phoneAuthSecret ?? readEnv("PHONE_AUTH_SECRET");

  const runtime = await createDiscoveredBotRuntime({
    app,
    commandOptions: options.commandOptions,
    cwd,
    flowSecret,
    miniAppUrl,
    phoneAuthSecret,
    services: options.services,
    storage: options.storage,
    storageTtlSeconds: options.storageTtlSeconds
  });

  let stopped = false;
  let pollTimeout: ReturnType<typeof setTimeout> | undefined;
  const commands = runtime.getCommands();

  // If the caller provided a custom bot, bind it and let them drive updates.
  if (options.bot) {
    runtime.bindBot(options.bot);

    if ("setCommands" in options.bot) {
      await (options.bot as PollingBot).setCommands(commands);
    }

    console.log(
      `[teleforge:bot] bot instance bound (${commands.length} commands registered)`
    );

    return {
      runtime,
      stop: () => {
        stopped = true;
        if (pollTimeout) {
          clearTimeout(pollTimeout);
        }
      }
    };
  }

  if (!token) {
    const previewBot = createPreviewBot((message) => {
      console.log("[teleforge:bot:preview]", message);
    });

    runtime.bindBot(previewBot);
    console.log("[teleforge:bot] BOT_TOKEN missing, running in preview mode");

    if (options.previewStart) {
      // Drive a minimal /start preview so the runtime is seeded immediately
      await runtime.handle({
        message: {
          chat: { id: 1, type: "private" },
          from: { first_name: "Preview", id: 1, username: "preview_user" },
          message_id: 1,
          text: "/start"
        },
        update_id: 1
      } satisfies TelegramUpdate);
    }

    // Keep the process alive in preview mode
    const keepAlive = setInterval(() => {}, 60_000);

    return {
      runtime,
      stop: () => {
        stopped = true;
        clearInterval(keepAlive);
      }
    };
  }

  const botInstance = createTeleforgePollingBot(token);
  runtime.bindBot(botInstance);
  await botInstance.setCommands(commands);

  console.log(
    `[teleforge:bot] polling Telegram for updates (${commands.length} commands registered)`
  );

  let offset: number | undefined;

  async function poll() {
    if (stopped) {
      return;
    }

    try {
      const updates = await botInstance.getUpdates(offset);

      for (const update of updates) {
        offset = typeof update.update_id === "number" ? update.update_id + 1 : offset;
        await runtime.handle(update);
      }
    } catch (error) {
      console.error("[teleforge:bot] polling error:", error);
      // Back off briefly on error to avoid tight-looping
      await new Promise((resolve) => {
        pollTimeout = setTimeout(resolve, 5_000);
      });
    }

    if (!stopped) {
      poll();
    }
  }

  poll();

  return {
    runtime,
    stop: () => {
      stopped = true;
      if (pollTimeout) {
        clearTimeout(pollTimeout);
      }
    }
  };
}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/* ───────────────────── Framework-owned polling / preview bots ───────────────────── */

interface PollingBot extends BotInstance {
  getUpdates(offset?: number): Promise<TelegramUpdate[]>;
  setCommands(commands: Iterable<Pick<BotCommandDefinition, "command" | "description">>): Promise<void>;
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
        ...toTelegramSendMessageOptions(options)
      });
    },
    async setCommands(commands) {
      await callTelegramApi(baseUrl, "setMyCommands", {
        commands: Array.from(commands, (command) => ({
          command: command.command,
          description: command.description ?? command.command
        }))
      });
    }
  };
}

function createPreviewBot(log: (message: string) => void): BotInstance {
  let messageId = 0;

  return {
    async sendMessage(chatId, text, options = {}) {
      messageId += 1;
      log(
        JSON.stringify(
          {
            chatId,
            options,
            text
          },
          null,
          2
        )
      );
      return {
        chat: { id: chatId },
        message_id: messageId,
        text
      } as TelegramMessage;
    }
  };
}

async function callTelegramApi<T>(baseUrl: string, method: string, body: Record<string, unknown>): Promise<T> {
  const url = `${baseUrl}/${method}`;
  const payload = JSON.stringify(body);
  const target = new URL(url);
  const timeoutSeconds = typeof body.timeout === "number" ? body.timeout : 0;
  const timeoutMs = Math.max(10_000, (timeoutSeconds + 10) * 1_000);

  return new Promise<T>((resolve, reject) => {
    const request = https.request(
      {
        family: 4,
        headers: {
          "content-length": Buffer.byteLength(payload),
          "content-type": "application/json"
        },
        hostname: target.hostname,
        method: "POST",
        path: `${target.pathname}${target.search}`,
        port: target.port ? Number(target.port) : 443
      },
      (response) => {
        let responseBody = "";

        response.setEncoding("utf8");
        response.on("data", (chunk: string) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          try {
            const parsed = JSON.parse(responseBody) as {
              description?: string;
              ok: boolean;
              result: T;
            };

            if (response.statusCode! < 200 || response.statusCode! >= 300 || !parsed.ok) {
              throw new Error(
                parsed.description ??
                  `Telegram API request failed (${response.statusCode}) while calling ${method}.`
              );
            }

            resolve(parsed.result);
          } catch (error) {
            reject(
              error instanceof Error
                ? error
                : new Error(`Telegram API ${method} returned unparseable response.`)
            );
          }
        });
      }
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Telegram API request timed out after ${timeoutMs}ms.`));
    });
    request.on("error", (error) => {
      reject(error);
    });
    request.write(payload);
    request.end();
  });
}

function toTelegramSendMessageOptions(options: ReplyOptions): Record<string, unknown> {
  return {
    disable_web_page_preview: options.disable_web_page_preview,
    parse_mode: options.parse_mode,
    reply_markup: options.reply_markup ? { ...options.reply_markup } : undefined,
    reply_to_message_id: options.reply_to_message_id
  };
}
