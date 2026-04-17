export {
  defineTeleforgeApp,
  teleforgeAppToManifest,
  type TeleforgeAppConfig,
  type TeleforgeAppIdentity,
  type TeleforgeMiniAppConfig
} from "@teleforgex/core";

export type {
  RouteDefinition,
  TeleforgePermission,
  TeleforgeRouteCapability,
  TeleforgeRuntime
} from "@teleforgex/core";

export type ChatFlowStepDefinition = {
  actions?: ReadonlyArray<{
    handler?: unknown;
    label: string;
    to?: string;
  }>;
  message: string | ((input: { state: unknown }) => string);
  type: "chat";
};

export type MiniAppFlowStepDefinition = {
  onSubmit?: unknown;
  screen: string;
  type: "miniapp";
};

export type FlowStepDefinition = ChatFlowStepDefinition | MiniAppFlowStepDefinition;

export interface TeleforgeFlowDefinition<TState = unknown> {
  id: string;
  initialStep: string;
  state: TState;
  steps: Record<string, FlowStepDefinition>;
}

export function defineFlow<TState, TFlow extends TeleforgeFlowDefinition<TState>>(
  flow: TFlow
): TFlow {
  return Object.freeze(flow);
}
