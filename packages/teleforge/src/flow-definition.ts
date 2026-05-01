import type { UpdateContext, CallbackQueryContext, WebAppDataContext } from "@teleforgex/bot";
import type {
  ActionContextToken,
  ActionHandlerDefinition,
  ActionResult,
  LaunchMode,
  SessionHandle,
  SignContextFn,
  TeleforgeInputSchema
} from "@teleforgex/core";

type MaybePromise<T> = Promise<T> | T;

export interface ActionFlowCommandDefinition<TContext = unknown> {
  command: string;
  description: string;
  handler: (ctx: ActionFlowCommandHandlerContext<TContext>) => MaybePromise<void>;
}

export interface ActionFlowCommandHandlerContext<TContext = unknown> {
  ctx: UpdateContext;
  sign: SignContextFn;
  services: TContext;
  session?: SessionHandle;
}

export interface ActionFlowContactHandlerContext<TContext = unknown> {
  ctx: UpdateContext;
  shared: SharedPhoneContact;
  sign: SignContextFn;
  services: TContext;
}

export interface ActionFlowLocationHandlerContext<TContext = unknown> {
  ctx: UpdateContext;
  location: SharedLocation;
  sign: SignContextFn;
  services: TContext;
}

export interface ActionFlowCallbackHandlerContext<TContext = unknown> {
  ctx: CallbackQueryContext;
  services: TContext;
}

export interface ActionFlowWebAppDataHandlerContext<TContext = unknown> {
  ctx: WebAppDataContext;
  services: TContext;
}

export interface ActionFlowHandlers<TContext = unknown> {
  onContact?: (ctx: ActionFlowContactHandlerContext<TContext>) => MaybePromise<void>;
  onLocation?: (ctx: ActionFlowLocationHandlerContext<TContext>) => MaybePromise<void>;
  onCallback?: (ctx: ActionFlowCallbackHandlerContext<TContext>) => MaybePromise<void>;
  onWebAppData?: (ctx: ActionFlowWebAppDataHandlerContext<TContext>) => MaybePromise<void>;
}

export interface ActionFlowMiniAppDefinition {
  routes: Record<string, string>;
  defaultRoute?: string;
  title?: string;
  launchModes?: readonly LaunchMode[];
  requestWriteAccess?: boolean;
}

export interface ActionFlowSessionDefinition {
  enabled: true;
  ttlSeconds?: number;
  initialState?: Record<string, unknown>;
}

export interface ActionFlowActionDefinition<
  TContext = unknown,
  TInput = unknown
> extends ActionHandlerDefinition<TContext, TInput> {
  handler: (ctx: ActionFlowActionHandlerContext<TContext, TInput>) => MaybePromise<ActionResult>;
  input?: TeleforgeInputSchema<TInput>;
}

export interface ActionFlowActionHandlerContext<TContext = unknown, TInput = unknown> {
  ctx: ActionContextToken;
  input: TInput;
  services: TContext;
  session?: SessionHandle;
  sign: SignContextFn;
}

export interface ActionFlowDefinition<TContext = unknown> {
  id: string;
  command?: ActionFlowCommandDefinition<TContext>;
  handlers?: ActionFlowHandlers<TContext>;
  miniApp?: ActionFlowMiniAppDefinition;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actions?: Record<string, ActionFlowActionDefinition<TContext, any>>;
  session?: ActionFlowSessionDefinition;
}

export interface ActionFlowDefinitionInput<TContext = unknown> {
  id: string;
  command?: ActionFlowCommandDefinition<TContext>;
  handlers?: ActionFlowHandlers<TContext>;
  miniApp?: ActionFlowMiniAppDefinition;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actions?: Record<string, ActionFlowActionDefinition<TContext, any>>;
  session?: ActionFlowSessionDefinition;
}

export interface SharedPhoneContact {
  normalizedPhone: string;
  phoneNumber: string;
  telegramUserId: number;
}

export interface SharedLocation {
  latitude: number;
  longitude: number;
  horizontalAccuracy?: number;
}

export function defineFlow<TContext = unknown>(
  flow: ActionFlowDefinitionInput<TContext>
): Readonly<ActionFlowDefinition<TContext>> {
  if (typeof flow.id !== "string" || flow.id.trim().length === 0) {
    throw new Error("Flow id must be a non-empty string.");
  }

  if (flow.command && typeof flow.command.command !== "string") {
    throw new Error(`Flow "${flow.id}" command must define a command string.`);
  }

  if (flow.miniApp) {
    const routes = Object.keys(flow.miniApp.routes);
    if (routes.length === 0) {
      throw new Error(`Flow "${flow.id}" miniApp must define at least one route.`);
    }

    if (flow.miniApp.defaultRoute && !routes.includes(flow.miniApp.defaultRoute)) {
      throw new Error(
        `Flow "${flow.id}" miniApp defaultRoute "${flow.miniApp.defaultRoute}" is not a defined route.`
      );
    }
  }

  if (flow.session?.enabled) {
    if (flow.session.ttlSeconds !== undefined && flow.session.ttlSeconds <= 0) {
      throw new Error(`Flow "${flow.id}" session ttlSeconds must be greater than zero.`);
    }
  }

  return Object.freeze({
    ...flow,
    ...(flow.command ? { command: Object.freeze({ ...flow.command }) } : {}),
    ...(flow.handlers ? { handlers: Object.freeze({ ...flow.handlers }) } : {}),
    ...(flow.miniApp
      ? {
          miniApp: Object.freeze({
            ...flow.miniApp,
            routes: Object.freeze({ ...flow.miniApp.routes }),
            ...(flow.miniApp.launchModes
              ? { launchModes: Object.freeze([...flow.miniApp.launchModes]) }
              : {})
          })
        }
      : {}),
    ...(flow.actions ? { actions: Object.freeze({ ...flow.actions }) } : {}),
    ...(flow.session ? { session: Object.freeze({ ...flow.session }) } : {})
  });
}

export function resolveFlowAction(actionId: string) {
  return actionId.trim();
}
