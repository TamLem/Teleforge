import { initiateCoordinatedFlow } from "@teleforgex/bot";
import { defineCoordinationConfig } from "@teleforgex/core";

import { getFlowStep } from "./flow-definition.js";

export {
  chatStep,
  defineFlow,
  getFlowStep,
  isMiniAppStep,
  miniAppStep,
  openMiniAppAction,
  resolveFlowActionKey,
  returnToChatAction
} from "./flow-definition.js";

import type { FlowStepDefinition, TeleforgeFlowDefinition } from "./flow-definition.js";
import type { BotCommandDefinition, CommandContext, CoordinatedFlowOptions } from "@teleforgex/bot";
import type {
  CoordinationDefaults,
  LaunchEntryPoint,
  ResolvedCoordinationConfig,
  ReturnToChatMetadata,
  UserFlowStateManager
} from "@teleforgex/core";

type MaybePromise<T> = Promise<T> | T;

export type {
  ChatFlowStepDefinition,
  FlowActionDefinition,
  FlowHandlerContext,
  FlowStepDefinition,
  FlowSubmitContext,
  FlowTransitionResult,
  MiniAppFlowStepDefinition,
  TeleforgeFlowBotCommandDefinition,
  TeleforgeFlowBotDefinition,
  TeleforgeFlowDefinition,
  TeleforgeFlowDefinitionInput,
  TeleforgeFlowMiniAppDefinition
} from "./flow-definition.js";

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

  getFlowStep(options.flow, entryStep as keyof TSteps & string);

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
  const step = getFlowStep(options.flow, String(entryStep) as keyof TSteps & string);

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
