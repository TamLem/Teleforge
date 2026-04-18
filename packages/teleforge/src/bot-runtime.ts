import {
  createDefaultReturnHandlers,
  createBotRuntime,
  createFlowCallback,
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
): Promise<BotRuntime> {
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
    createFlowCommands({
      ...(options.commandOptions ?? {}),
      flows: flows.filter(({ flow }) => isMiniAppEntryFlow(flow)),
      secret: options.flowSecret,
      storage,
      webAppUrl: options.miniAppUrl
    })
  );
  runtime.registerCommands(
    createChatEntryCommands({
      flows: flows.filter(({ flow }) => !isMiniAppEntryFlow(flow)),
      handlers,
      secret: options.flowSecret,
      services: options.services,
      storage
    })
  );
  runtime.router.onCallbackQuery(
    createDiscoveredFlowCallbackHandler({
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
      flows,
      handlers,
      miniAppUrl: options.miniAppUrl,
      secret: options.flowSecret,
      services: options.services,
      storage
    })
  );

  return runtime;
}

interface CreateChatEntryCommandsOptions {
  flows: readonly DiscoveredFlowModule[];
  handlers: readonly DiscoveredFlowStepHandlerModule[];
  secret: string;
  services?: unknown;
  storage: UserFlowStateManager;
}

interface CreateDiscoveredFlowCallbackHandlerOptions {
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
          const stateKey = await options.storage.startFlow(
            String(context.user.id),
            flow.id,
            entryStep,
            {
              [FLOW_STATE_PAYLOAD_KEY]: cloneFlowState(flow.state)
            },
            String(context.chat.id)
          );

          await enterDiscoveredFlowStep(
            {
              chatId: context.chat.id,
              flow,
              handlers: options.handlers,
              secret: options.secret,
              services: options.services,
              state: cloneFlowState(flow.state),
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
    await context.answer();
    await enterDiscoveredFlowStep(
      {
        chatId,
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

      await context.answer("Returned to chat");
      await enterDiscoveredFlowStep(
        {
          chatId: persisted.chatId ?? context.chat.id,
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

      if (redirectedStepId !== previousStepId) {
        continue;
      }
    }

    if (step.type === "chat") {
      await sendChatStepMessage(
        runtime.bot,
        options.flow,
        step,
        currentState,
        options.secret,
        options.chatId
      );
      return;
    }

    if (!options.miniAppUrl) {
      throw new Error(
        `Flow "${options.flow.id}" step "${currentStepId}" requires a Mini App URL to continue.`
      );
    }

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
  chatId: number | string
): Promise<void> {
  const text = typeof step.message === "function" ? step.message({ state }) : step.message;
  const actions = (step.actions ?? []).map((action) => [
    createFlowCallback(
      {
        action: resolveFlowActionKey(action),
        flowId: flow.id,
        text: action.label
      },
      secret
    )
  ]);

  await bot.sendMessage(chatId, text, {
    ...(actions.length > 0
      ? {
          reply_markup: {
            inline_keyboard: actions
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
