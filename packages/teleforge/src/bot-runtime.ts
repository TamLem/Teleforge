import {
  createDefaultReturnHandlers,
  createBotRuntime,
  createFlowCallback,
  createMiniAppButton,
  createSignedPayload,
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
  WebAppDataHandler
} from "@teleforgex/bot";
import type { TeleforgeAppConfig } from "@teleforgex/core";

const FLOW_STATE_PAYLOAD_KEY = "__teleforge_flow_state";
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
  currentStepId: string;
  currentStepType: "chat" | "miniapp";
  flowId: string;
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
  discoveredRuntime.handleChatHandoff = async (input) => {
    console.log("[teleforge:bot-runtime] handleChatHandoff called:", {
      flowContext: input.flowContext.substring(0, 30) + "...",
      stateKey: input.stateKey,
      stepId: input.stepId
    });
    const flowContext = extractFlowContext(input.flowContext, options.flowSecret);

    if (!flowContext || flowContext.payload.stateKey !== input.stateKey) {
      console.log("[teleforge:bot-runtime] handleChatHandoff: flow context verification failed", {
        hasFlowContext: !!flowContext,
        stateKeyMatch: flowContext?.payload.stateKey === input.stateKey
      });
      throw new Error("Could not verify chat handoff flow context.");
    }

    const flow = flows.find(({ flow: f }) => f.id === flowContext.flowId)?.flow;

    if (!flow) {
      throw new Error(`Unknown flow "${flowContext.flowId}" in chat handoff.`);
    }

    const persisted = await storage.getState(input.stateKey);

    if (!persisted) {
      throw new Error("Flow state expired before chat handoff.");
    }

    console.log("[teleforge:bot-runtime] handleChatHandoff: state found, advancing step", {
      chatId: persisted.chatId,
      flowId: flow.id,
      stepId: input.stepId
    });

    const handlerIndex = createHandlerIndex(handlers);
    await storage.advanceStep(input.stateKey, input.stepId, {
      [FLOW_STATE_PAYLOAD_KEY]: cloneFlowState(input.state)
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

    console.log("[teleforge:bot-runtime] handleChatHandoff: entering flow step", {
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
  secret: string;
  services?: unknown;
  storage: UserFlowStateManager;
}

interface CreateDiscoveredFlowCallbackHandlerOptions {
  debugTracker: FlowRuntimeDebugTracker;
  flows: readonly DiscoveredFlowModule[];
  handlers: readonly DiscoveredFlowStepHandlerModule[];
  miniAppUrl: string;
  secret: string;
  services?: unknown;
  storage: UserFlowStateManager;
}

interface CreateDiscoveredFlowWebAppDataHandlerOptions
  extends CreateDiscoveredFlowCallbackHandlerOptions {}

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
        options.debugTracker.trackMiniAppLaunch({
          chatId: String(context.chat.id),
          flow,
          snapshotStateAvailable: true,
          stateKey: options.storage.createStateKey(String(context.user.id), flow.id),
          stepId: entryStepId,
          userId: String(context.user.id)
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
          const stateKey = await options.storage.startFlow(
            userId,
            flow.id,
            entryStep,
            {
              [FLOW_STATE_PAYLOAD_KEY]: initialState
            },
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

    const currentState = readPersistedFlowState(flow, persisted.payload);
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

    await options.storage.advanceStep(stateKey, nextStepId, {
      [FLOW_STATE_PAYLOAD_KEY]: nextState
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

      const persisted = await options.storage.getState(handoff.stateKey);

      if (!persisted) {
        await context.answer("Flow expired before chat handoff");
        return;
      }

      await options.storage.advanceStep(handoff.stateKey, handoff.stepId, {
        [FLOW_STATE_PAYLOAD_KEY]: cloneFlowState(handoff.state)
      });
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
    (await options.storage.getState(options.stateKey))?.stepId ?? options.flow.initialStep
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

      await options.storage.advanceStep(options.stateKey, redirectedStepId, {
        [FLOW_STATE_PAYLOAD_KEY]: currentState
      });
      currentStepId = redirectedStepId;
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
      await options.storage.advanceStep(options.stateKey, currentStepId, {
        [FLOW_STATE_PAYLOAD_KEY]: currentState
      });
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
  const buttons = (step.actions ?? []).map((action) => [
    action.miniApp && miniAppUrl
      ? createMiniAppButton({
          requestWriteAccess: flow.miniApp?.requestWriteAccess,
          startPayload: createSignedPayload(
            {
              flowId: flow.id,
              payload: {
                ...action.miniApp.payload,
                route: resolveFlowStepRoute(flow, action.to ?? flow.initialStep as string) ?? undefined,
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
}

interface FlowRuntimeDebugEventInput {
  chatId?: string;
  flow: TeleforgeFlowDefinition<unknown, unknown>;
  snapshotStateAvailable: boolean;
  stateKey: string;
  stepId: string;
  userId?: string;
}

interface MutableDiscoveredFlowRuntimeSessionDebugState extends DiscoveredFlowRuntimeSessionDebugState {
  miniApp: DiscoveredFlowRuntimeMiniAppDebugState;
}

function createFlowRuntimeDebugTracker(): FlowRuntimeDebugTracker {
  const sessions = new Map<string, MutableDiscoveredFlowRuntimeSessionDebugState>();
  let updatedAt: string | null = null;

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
      currentStepId: input.stepId,
      currentStepType: step.type,
      flowId: input.flow.id,
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
      const step = getFlowStep(input.flow, input.stepId);

      session.currentStepId = input.stepId;
      session.currentStepType = step.type;
      session.currentRoute = step.type === "miniapp" ? resolveFlowStepRoute(input.flow, input.stepId) : null;
      session.snapshotStateAvailable = session.snapshotStateAvailable || input.snapshotStateAvailable;
      session.miniApp.lastHandoffAt = new Date().toISOString();
      session.miniApp.lastResumeAt = session.miniApp.lastHandoffAt;
      session.miniApp.pendingChatHandoff = false;
      session.miniApp.resumedStepId = input.stepId;
      touch(session);
    },
    trackMiniAppLaunch(input) {
      const session = ensureSession(input);
      const route = resolveFlowStepRoute(input.flow, input.stepId);

      session.currentStepId = input.stepId;
      session.currentStepType = "miniapp";
      session.currentRoute = route;
      session.snapshotStateAvailable = session.snapshotStateAvailable || input.snapshotStateAvailable;
      session.miniApp.lastLaunchAt = new Date().toISOString();
      session.miniApp.lastLaunchRoute = route;
      session.miniApp.lastLaunchStepId = input.stepId;
      session.miniApp.pendingChatHandoff = true;
      touch(session);
    },
    trackStep(input) {
      const session = ensureSession(input);
      const step = getFlowStep(input.flow, input.stepId);

      session.currentStepId = input.stepId;
      session.currentStepType = step.type;
      session.currentRoute = step.type === "miniapp" ? resolveFlowStepRoute(input.flow, input.stepId) : null;
      session.snapshotStateAvailable = session.snapshotStateAvailable || input.snapshotStateAvailable;

      if (step.type === "chat") {
        session.miniApp.pendingChatHandoff = false;
      }

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
  payload: Record<string, unknown>
): unknown {
  return FLOW_STATE_PAYLOAD_KEY in payload
    ? cloneFlowState(payload[FLOW_STATE_PAYLOAD_KEY])
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
