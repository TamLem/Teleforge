import type {
  LaunchEntryPoint,
  ReturnToChatMetadata,
  RouteDefinition
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
  handler?: (
    input: FlowHandlerContext<TState, TServices>
  ) => MaybePromise<void | FlowTransitionResult<TState>>;
  label: string;
  miniApp?: {
    payload?: Record<string, unknown>;
  };
  to?: string;
}

export interface ChatFlowStepDefinition<TState, TServices = unknown> {
  actions?: ReadonlyArray<FlowActionDefinition<TState, TServices>>;
  message: string | ((input: { state: TState }) => string);
  onEnter?: (
    input: FlowHandlerContext<TState, TServices>
  ) => MaybePromise<void | FlowTransitionResult<TState>>;
  type: "chat";
}

export interface MiniAppFlowStepDefinition<TState, TData = unknown, TServices = unknown> {
  actions?: ReadonlyArray<FlowActionDefinition<TState, TServices>>;
  onEnter?: (
    input: FlowHandlerContext<TState, TServices>
  ) => MaybePromise<void | FlowTransitionResult<TState>>;
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

function freezeBotDefinition(
  bot: TeleforgeFlowBotDefinition
): Readonly<TeleforgeFlowBotDefinition> {
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

function freezeSteps<
  TState,
  TServices,
  TSteps extends Record<string, FlowStepDefinition<TState, TServices>>
>(steps: TSteps): Readonly<{ [K in keyof TSteps]: Readonly<TSteps[K]> }> {
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
