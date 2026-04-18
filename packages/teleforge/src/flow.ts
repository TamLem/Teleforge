import { initiateCoordinatedFlow } from "@teleforgex/bot";
import { defineCoordinationConfig } from "@teleforgex/core";

import type { BotCommandDefinition, CommandContext, CoordinatedFlowOptions } from "@teleforgex/bot";
import type {
  CoordinationDefaults,
  LaunchEntryPoint,
  RouteDefinition,
  ResolvedCoordinationConfig,
  ReturnToChatMetadata,
  UserFlowStateManager
} from "@teleforgex/core";

type MaybePromise<T> = Promise<T> | T;

export interface FlowTransitionResult<TState> {
  state?: TState;
  to?: string;
}

export interface TeleforgeFlowBotCommandDefinition {
  buttonText?: string;
  command: string;
  description?: string;
  entryStep?: string;
  text: string;
}

export interface TeleforgeFlowBotDefinition {
  command?: TeleforgeFlowBotCommandDefinition;
}

export interface TeleforgeFlowMiniAppDefinition {
  capabilities?: RouteDefinition["capabilities"];
  component?: RouteDefinition["component"];
  description?: RouteDefinition["description"];
  guards?: RouteDefinition["guards"];
  launchModes?: RouteDefinition["launchModes"];
  meta?: RouteDefinition["meta"];
  entryPoints?: readonly LaunchEntryPoint[];
  requestWriteAccess?: boolean;
  returnToChat?: ReturnToChatMetadata;
  route: string;
  stepRoutes?: Readonly<Record<string, string>>;
  title?: RouteDefinition["title"];
  ui?: RouteDefinition["ui"];
}

export interface FlowHandlerContext<
  TState,
  TServices = unknown,
  TFlow extends TeleforgeFlowDefinition<TState, TServices> = TeleforgeFlowDefinition<
    TState,
    TServices
  >
> {
  flow: TFlow;
  services: TServices;
  state: TState;
}

export interface FlowSubmitContext<
  TState,
  TData = unknown,
  TServices = unknown,
  TFlow extends TeleforgeFlowDefinition<TState, TServices> = TeleforgeFlowDefinition<
    TState,
    TServices
  >
> extends FlowHandlerContext<TState, TServices, TFlow> {
  data: TData;
}

export interface FlowActionDefinition<TState, TServices = unknown> {
  id?: string;
  handler?: (input: FlowHandlerContext<TState, TServices>) => MaybePromise<void | FlowTransitionResult<TState>>;
  label: string;
  to?: string;
}

export interface ChatFlowStepDefinition<TState, TServices = unknown> {
  actions?: ReadonlyArray<FlowActionDefinition<TState, TServices>>;
  message: string | ((input: { state: TState }) => string);
  onEnter?: (input: FlowHandlerContext<TState, TServices>) => MaybePromise<void | FlowTransitionResult<TState>>;
  type: "chat";
}

export interface MiniAppFlowStepDefinition<TState, TData = unknown, TServices = unknown> {
  onEnter?: (input: FlowHandlerContext<TState, TServices>) => MaybePromise<void | FlowTransitionResult<TState>>;
  onSubmit?: (
    input: FlowSubmitContext<TState, TData, TServices>
  ) => MaybePromise<void | FlowTransitionResult<TState>>;
  screen: string;
  type: "miniapp";
}

export type FlowStepDefinition<TState = unknown, TServices = unknown> =
  | ChatFlowStepDefinition<TState, TServices>
  | MiniAppFlowStepDefinition<TState, unknown, TServices>;

export interface TeleforgeFlowDefinition<
  TState = unknown,
  TServices = unknown,
  TSteps extends Record<string, FlowStepDefinition<TState, TServices>> = Record<
    string,
    FlowStepDefinition<TState, TServices>
  >
> {
  bot?: TeleforgeFlowBotDefinition;
  finalStep: keyof TSteps & string;
  id: string;
  initialStep: keyof TSteps & string;
  miniApp?: TeleforgeFlowMiniAppDefinition;
  onComplete?: "close" | "return_to_chat" | string;
  state: TState;
  steps: Readonly<{
    [K in keyof TSteps]: Readonly<TSteps[K]>;
  }>;
}

export interface TeleforgeFlowDefinitionInput<
  TState = unknown,
  TServices = unknown,
  TSteps extends Record<string, FlowStepDefinition<TState, TServices>> = Record<
    string,
    FlowStepDefinition<TState, TServices>
  >
> {
  bot?: TeleforgeFlowBotDefinition;
  finalStep?: keyof TSteps & string;
  id: string;
  initialStep: keyof TSteps & string;
  miniApp?: TeleforgeFlowMiniAppDefinition;
  onComplete?: "close" | "return_to_chat" | string;
  state: TState;
  steps: TSteps;
}

export interface CreateFlowCoordinationConfigOptions<
  TState,
  TServices = unknown,
  TSteps extends Record<string, FlowStepDefinition<TState, TServices>> = Record<
    string,
    FlowStepDefinition<TState, TServices>
  >
> {
  defaults?: Partial<CoordinationDefaults>;
  entryPoints?: readonly LaunchEntryPoint[];
  entryStep?: keyof TSteps & string;
  flow: TeleforgeFlowDefinition<TState, TServices, TSteps>;
  requestWriteAccess?: boolean;
  returnToChat?: ReturnToChatMetadata;
  route: string;
  stepRoutes?: Readonly<Record<string, string>>;
}

export interface CreateFlowStartCommandOptions<
  TState,
  TServices = unknown,
  TSteps extends Record<string, FlowStepDefinition<TState, TServices>> = Record<
    string,
    FlowStepDefinition<TState, TServices>
  >
> {
  buttonText?: string | ((context: CommandContext) => MaybePromise<string | undefined>);
  command: string;
  description?: string;
  entryStep?: keyof TSteps & string;
  flow: TeleforgeFlowDefinition<TState, TServices, TSteps>;
  messageOptions?: CoordinatedFlowOptions["messageOptions"];
  payload?:
    | Record<string, unknown>
    | ((context: CommandContext) => MaybePromise<Record<string, unknown> | undefined>);
  requestWriteAccess?: boolean;
  returnText?: string | ((context: CommandContext) => MaybePromise<string | undefined>);
  secret: string;
  stayInChat?: boolean;
  storage: UserFlowStateManager;
  text: string | ((context: CommandContext) => MaybePromise<string>);
  webAppUrl: string | ((context: CommandContext) => MaybePromise<string>);
}

const DEFAULT_COORDINATION_DEFAULTS = Object.freeze({
  expiryMinutes: 15,
  persistence: "session"
}) as CoordinationDefaults;

export function defineFlow<
  TState,
  TServices = unknown,
  TSteps extends Record<string, FlowStepDefinition<TState, TServices>> = Record<
    string,
    FlowStepDefinition<TState, TServices>
  >
>(
  flow: TeleforgeFlowDefinitionInput<TState, TServices, TSteps>
): TeleforgeFlowDefinition<TState, TServices, TSteps> {
  const stepIds = Object.keys(flow.steps);

  if (typeof flow.id !== "string" || flow.id.trim().length === 0) {
    throw new Error("Flow id must be a non-empty string.");
  }

  if (stepIds.length === 0) {
    throw new Error(`Flow "${flow.id}" must define at least one step.`);
  }

  assertStepExists(flow.id, stepIds, String(flow.initialStep), "initialStep");

  const finalStep = flow.finalStep ? String(flow.finalStep) : stepIds[stepIds.length - 1];
  assertStepExists(flow.id, stepIds, finalStep, "finalStep");

  if (flow.bot?.command?.entryStep) {
    assertStepExists(flow.id, stepIds, flow.bot.command.entryStep, "bot.command.entryStep");
  }

  for (const [stepId, step] of Object.entries(flow.steps)) {
    if (step.type === "chat") {
      const seenActionKeys = new Set<string>();

      for (const action of step.actions ?? []) {
        const actionKey = resolveFlowActionKey(action);

        if (seenActionKeys.has(actionKey)) {
          throw new Error(
            `Flow "${flow.id}" step "${stepId}" defines duplicate action key "${actionKey}".`
          );
        }

        seenActionKeys.add(actionKey);

        if (action.to) {
          assertStepExists(flow.id, stepIds, action.to, `steps.${stepId}.actions.to`);
        }
      }
    }
  }

  const steps = freezeSteps<TState, TServices, TSteps>(flow.steps);

  return Object.freeze({
    ...(flow.bot ? { bot: freezeBotDefinition(flow.bot) } : {}),
    finalStep: finalStep as keyof TSteps & string,
    id: flow.id,
    initialStep: String(flow.initialStep) as keyof TSteps & string,
    ...(flow.miniApp ? { miniApp: freezeMiniAppDefinition(flow.miniApp) } : {}),
    ...(flow.onComplete ? { onComplete: flow.onComplete } : {}),
    state: flow.state,
    steps
  }) as TeleforgeFlowDefinition<TState, TServices, TSteps>;
}

export function resolveFlowActionKey<TState, TServices = unknown>(
  action: FlowActionDefinition<TState, TServices>
): string {
  if (typeof action.id === "string" && action.id.trim().length > 0) {
    return action.id.trim();
  }

  const normalized = action.label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length > 0 ? normalized : "action";
}

export function createFlowCoordinationConfig<
  TState,
  TServices = unknown,
  TSteps extends Record<string, FlowStepDefinition<TState, TServices>> = Record<
    string,
    FlowStepDefinition<TState, TServices>
  >
>(
  options: CreateFlowCoordinationConfigOptions<TState, TServices, TSteps>
): ResolvedCoordinationConfig {
  const entryStep = options.entryStep
    ? String(options.entryStep)
    : String(options.flow.initialStep);

  assertStepExists(options.flow.id, Object.keys(options.flow.steps), entryStep, "entryStep");

  return defineCoordinationConfig({
    defaults: {
      ...DEFAULT_COORDINATION_DEFAULTS,
      ...(options.defaults ?? {})
    },
    flows: {
      [options.flow.id]: {
        defaultStep: String(options.flow.initialStep),
        finalStep: String(options.flow.finalStep),
        ...(options.flow.onComplete ? { onComplete: options.flow.onComplete } : {}),
        steps: Object.freeze(Object.keys(options.flow.steps))
      }
    },
    routes: {
      [options.route]: {
        entryPoints: Object.freeze([...(options.entryPoints ?? [])]),
        flow: {
          entryStep,
          flowId: options.flow.id,
          ...(options.requestWriteAccess ? { requestWriteAccess: true } : {})
        },
        ...(options.returnToChat ? { returnToChat: options.returnToChat } : {}),
        ...(options.stepRoutes ? { stepRoutes: Object.freeze({ ...options.stepRoutes }) } : {})
      }
    }
  });
}

export function createFlowStartCommand<
  TState,
  TServices = unknown,
  TSteps extends Record<string, FlowStepDefinition<TState, TServices>> = Record<
    string,
    FlowStepDefinition<TState, TServices>
  >
>(options: CreateFlowStartCommandOptions<TState, TServices, TSteps>): BotCommandDefinition {
  const entryStep = (options.entryStep ?? options.flow.initialStep) as keyof TSteps & string;
  const step = getFlowStep(options.flow, String(entryStep));

  if (step.type !== "miniapp") {
    throw new Error(
      `Flow "${options.flow.id}" step "${String(entryStep)}" must be a miniapp step to create a start command.`
    );
  }

  return {
    command: options.command,
    description: options.description,
    async handler(context) {
      if (!context.bot) {
        throw new Error(
          `Flow command "/${options.command}" requires an attached bot instance to send the launch message.`
        );
      }

      await initiateCoordinatedFlow(context.bot, options.storage, {
        buttonText: await resolveCommandValue(options.buttonText, context),
        chatId: context.chat.id,
        flowId: options.flow.id,
        initialStep: String(entryStep),
        messageOptions: options.messageOptions,
        payload: (await resolveCommandValue(options.payload, context)) ?? {},
        requestWriteAccess: options.requestWriteAccess,
        returnText: await resolveCommandValue(options.returnText, context),
        secret: options.secret,
        stayInChat: options.stayInChat,
        text: await resolveRequiredCommandValue(options.text, context),
        userId: String(context.user.id),
        webAppUrl: await resolveRequiredCommandValue(options.webAppUrl, context)
      });
    }
  };
}

export function getFlowStep<
  TState,
  TServices = unknown,
  TSteps extends Record<string, FlowStepDefinition<TState, TServices>> = Record<
    string,
    FlowStepDefinition<TState, TServices>
  >
>(
  flow: TeleforgeFlowDefinition<TState, TServices, TSteps>,
  stepId: keyof TSteps & string
): Readonly<TSteps[keyof TSteps]> {
  assertStepExists(flow.id, Object.keys(flow.steps), String(stepId), "stepId");
  return flow.steps[stepId];
}

export function isMiniAppStep<TState, TServices = unknown>(
  step: FlowStepDefinition<TState, TServices>
): step is MiniAppFlowStepDefinition<TState, unknown, TServices> {
  return step.type === "miniapp";
}

function freezeBotDefinition(bot: TeleforgeFlowBotDefinition): Readonly<TeleforgeFlowBotDefinition> {
  return Object.freeze({
    ...(bot.command
      ? {
          command: Object.freeze({
            ...bot.command
          })
        }
      : {})
  });
}

function freezeMiniAppDefinition(
  miniApp: TeleforgeFlowMiniAppDefinition
): Readonly<TeleforgeFlowMiniAppDefinition> {
  return Object.freeze({
    ...miniApp,
    ...(miniApp.entryPoints ? { entryPoints: Object.freeze([...miniApp.entryPoints]) } : {}),
    ...(miniApp.stepRoutes ? { stepRoutes: Object.freeze({ ...miniApp.stepRoutes }) } : {})
  });
}

function assertStepExists(flowId: string, stepIds: string[], stepId: string, field: string): void {
  if (!stepIds.includes(stepId)) {
    throw new Error(`Flow "${flowId}" ${field} references unknown step "${stepId}".`);
  }
}

function freezeSteps<TState, TServices, TSteps extends Record<string, FlowStepDefinition<TState, TServices>>>(
  steps: TSteps
): Readonly<{ [K in keyof TSteps]: Readonly<TSteps[K]> }> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(steps).map(([stepId, step]) => [
        stepId,
        Object.freeze({
          ...step,
          ...(step.type === "chat" && step.actions
            ? {
                actions: Object.freeze(
                  step.actions.map((action) =>
                    Object.freeze({
                      ...action
                    })
                  )
                )
              }
            : {})
        })
      ])
    )
  ) as unknown as Readonly<{ [K in keyof TSteps]: Readonly<TSteps[K]> }>;
}

async function resolveCommandValue<T>(
  value: T | ((context: CommandContext) => MaybePromise<T>) | undefined,
  context: CommandContext
): Promise<T | undefined> {
  if (typeof value === "function") {
    return (value as (context: CommandContext) => MaybePromise<T>)(context);
  }

  return value;
}

async function resolveRequiredCommandValue<T>(
  value: T | ((context: CommandContext) => MaybePromise<T>),
  context: CommandContext
): Promise<T> {
  return (await resolveCommandValue(value, context)) as T;
}
