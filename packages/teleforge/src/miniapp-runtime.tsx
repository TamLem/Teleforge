import { useLaunch } from "@teleforgex/web";
import { useEffect, useState } from "react";

import { getFlowStep, isMiniAppStep, resolveFlowActionKey } from "./flow.js";
import { resolveMiniAppScreen } from "./screens.js";

import type { DiscoveredFlowModule, DiscoveredFlowStepHandlerModule } from "./discovery.js";
import type { FlowActionDefinition, FlowTransitionResult, TeleforgeFlowDefinition } from "./flow.js";
import type {
  DiscoveredScreenModule,
  ResolvedMiniAppScreen,
  TeleforgeScreenDefinition,
  TeleforgeScreenGuardBlock,
  TeleforgeScreenRuntimeContext,
  UnresolvedMiniAppScreen
} from "./screens.js";
import type { ReactNode } from "react";

type AnyFlowDefinition = TeleforgeFlowDefinition<unknown, unknown>;

export interface TeleforgeMiniAppProps {
  fallback?: ReactNode;
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>;
  loadingFallback?: ReactNode;
  pathname?: string;
  renderBlocked?: (error: BlockedMiniAppScreen) => ReactNode;
  renderError?: (error: UnresolvedMiniAppScreen) => ReactNode;
  renderRuntimeError?: (error: RuntimeErrorMiniAppScreen) => ReactNode;
  screens: Iterable<TeleforgeScreenDefinition | DiscoveredScreenModule>;
}

export interface UseTeleforgeMiniAppRuntimeOptions
  extends Omit<TeleforgeMiniAppProps, "fallback" | "loadingFallback" | "renderBlocked" | "renderError"> {}

export interface ReadyMiniAppScreen extends ResolvedMiniAppScreen {
  loaderData?: unknown;
  status: "ready";
}

export interface BlockedMiniAppScreen extends ResolvedMiniAppScreen {
  block: TeleforgeScreenGuardBlock;
  status: "blocked";
}

export interface PendingMiniAppScreen {
  resolution: ResolvedMiniAppScreen | UnresolvedMiniAppScreen;
  status: "pending";
}

export interface UnresolvedMiniAppRuntimeScreen extends UnresolvedMiniAppScreen {
  status: "unresolved";
}

export interface RuntimeErrorMiniAppScreen {
  error: Error;
  resolution: ResolvedMiniAppScreen;
  status: "runtime_error";
}

export interface ExecuteMiniAppStepSubmitOptions<TData = unknown> {
  data: TData;
  handlers?: Iterable<DiscoveredFlowStepHandlerModule>;
  resolution: ResolvedMiniAppScreen | ReadyMiniAppScreen;
  services?: unknown;
}

export interface ExecuteMiniAppStepActionOptions {
  action: string;
  handlers?: Iterable<DiscoveredFlowStepHandlerModule>;
  resolution: ResolvedMiniAppScreen | ReadyMiniAppScreen;
  services?: unknown;
}

interface MiniAppTransitionBase {
  flow: AnyFlowDefinition;
  fromStepId: string;
  state: unknown;
  stepId: string;
}

export interface ChatMiniAppTransitionResult extends MiniAppTransitionBase {
  target: "chat";
}

export interface ScreenMiniAppTransitionResult extends MiniAppTransitionBase {
  routePath: string;
  screenId: string;
  target: "miniapp";
}

export type MiniAppStepExecutionResult = ChatMiniAppTransitionResult | ScreenMiniAppTransitionResult;

export type TeleforgeMiniAppRuntimeState =
  | ReadyMiniAppScreen
  | BlockedMiniAppScreen
  | PendingMiniAppScreen
  | RuntimeErrorMiniAppScreen
  | UnresolvedMiniAppRuntimeScreen;

export function TeleforgeMiniApp(props: TeleforgeMiniAppProps) {
  const resolution = useTeleforgeMiniAppRuntime(props);

  if (resolution.status === "pending") {
    if (props.loadingFallback) {
      return <>{props.loadingFallback}</>;
    }

    if ("reason" in resolution.resolution) {
      return <DefaultMiniAppPending />;
    }

    return <DefaultMiniAppPending screenId={resolution.resolution.screenId} />;
  }

  if (resolution.status === "blocked") {
    if (props.renderBlocked) {
      return <>{props.renderBlocked(resolution)}</>;
    }

    return <DefaultMiniAppBlocked error={resolution} />;
  }

  if (resolution.status === "runtime_error") {
    if (props.renderRuntimeError) {
      return <>{props.renderRuntimeError(resolution)}</>;
    }

    return <DefaultMiniAppRuntimeError error={resolution} />;
  }

  if (resolution.status === "unresolved") {
    if (props.renderError) {
      return <>{props.renderError(resolution)}</>;
    }

    if (props.fallback) {
      return <>{props.fallback}</>;
    }

    return <DefaultMiniAppError error={resolution} />;
  }

  const Screen = resolution.screen.component;

  return (
    <Screen
      flow={resolution.flow}
      flowId={resolution.flowId}
      loaderData={resolution.loaderData}
      routePath={resolution.routePath}
      screenId={resolution.screenId}
      state={resolution.state}
      stepId={resolution.stepId}
    />
  );
}

export function useTeleforgeMiniAppRuntime(
  options: UseTeleforgeMiniAppRuntimeOptions
): TeleforgeMiniAppRuntimeState {
  const launch = useLaunch();
  const pathname = options.pathname ?? resolveWindowPathname();
  const [state, setState] = useState<TeleforgeMiniAppRuntimeState>(() => {
    const resolution = resolveMiniAppScreen({
      flows: options.flows,
      pathname,
      screens: options.screens
    });

    if ("reason" in resolution) {
      return createUnresolvedRuntimeState(resolution);
    }

    return {
      resolution,
      status: "pending"
    };
  });

  useEffect(() => {
    let isCancelled = false;
    const resolution = resolveMiniAppScreen({
      flows: options.flows,
      pathname,
      screens: options.screens
    });

    if ("reason" in resolution) {
      setState(createUnresolvedRuntimeState(resolution));
      return;
    }

    setState({
      resolution,
      status: "pending"
    });

    loadMiniAppScreenRuntime(resolution)
      .then((nextState) => {
        if (!isCancelled) {
          setState(nextState);
        }
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        setState({
          error:
            error instanceof Error ? error : new Error("Unknown Teleforge Mini App runtime error."),
          resolution,
          status: "runtime_error"
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [launch.startParam, options.flows, pathname, options.screens]);

  return state;
}

export async function loadMiniAppScreenRuntime(
  resolution: ResolvedMiniAppScreen
): Promise<ReadyMiniAppScreen | BlockedMiniAppScreen> {
  const context = createRuntimeContext(resolution);
  const guardResult = resolution.screen.guard
    ? await resolution.screen.guard(context)
    : true;

  if (guardResult !== true) {
    if (guardResult === false) {
      return {
        ...resolution,
        block: {
          allow: false
        },
        status: "blocked"
      };
    }

    return {
      ...resolution,
      block: guardResult,
      status: "blocked"
    };
  }

  return {
    ...resolution,
    ...(resolution.screen.loader
      ? {
          loaderData: await resolution.screen.loader(context)
        }
      : {}),
    status: "ready"
  };
}

export async function executeMiniAppStepSubmit<TData = unknown>(
  options: ExecuteMiniAppStepSubmitOptions<TData>
): Promise<MiniAppStepExecutionResult> {
  const step = getFlowStep(options.resolution.flow, options.resolution.stepId);

  if (!isMiniAppStep(step)) {
    throw new Error(
      `Flow "${options.resolution.flowId}" step "${options.resolution.stepId}" is not a Mini App step.`
    );
  }

  const handlerIndex = createMiniAppHandlerIndex(options.handlers);
  const handlerModule = handlerIndex.get(
    createMiniAppHandlerKey(options.resolution.flowId, options.resolution.stepId)
  );
  const onSubmit = step.onSubmit ?? handlerModule?.onSubmit;

  if (!onSubmit) {
    throw new Error(
      `Flow "${options.resolution.flowId}" step "${options.resolution.stepId}" does not define an onSubmit handler.`
    );
  }

  const result = await onSubmit({
    data: options.data,
    flow: options.resolution.flow,
    services: options.services,
    state: options.resolution.state
  });

  return resolveMiniAppTransition(options.resolution, result, options.resolution.stepId);
}

export async function executeMiniAppStepAction(
  options: ExecuteMiniAppStepActionOptions
): Promise<MiniAppStepExecutionResult> {
  const step = getFlowStep(options.resolution.flow, options.resolution.stepId);

  if (!isMiniAppStep(step)) {
    throw new Error(
      `Flow "${options.resolution.flowId}" step "${options.resolution.stepId}" is not a Mini App step.`
    );
  }

  const handlerIndex = createMiniAppHandlerIndex(options.handlers);
  const handlerModule = handlerIndex.get(
    createMiniAppHandlerKey(options.resolution.flowId, options.resolution.stepId)
  );
  const actionDefinition = (step.actions ?? []).find(
    (candidate) => resolveFlowActionKey(candidate) === options.action
  );
  const actionHandler =
    actionDefinition?.handler ?? handlerModule?.actions[options.action] ?? undefined;

  if (!actionHandler && !actionDefinition?.to) {
    throw new Error(
      `Flow "${options.resolution.flowId}" step "${options.resolution.stepId}" action "${options.action}" is not wired.`
    );
  }

  const result = actionHandler
    ? await actionHandler({
        flow: options.resolution.flow,
        services: options.services,
        state: options.resolution.state
      })
    : undefined;

  return resolveMiniAppTransition(options.resolution, result, options.resolution.stepId, actionDefinition);
}

function createRuntimeContext(
  resolution: ResolvedMiniAppScreen
): TeleforgeScreenRuntimeContext<unknown> {
  return {
    flow: resolution.flow,
    flowId: resolution.flowId,
    routePath: resolution.routePath,
    screenId: resolution.screenId,
    state: resolution.state,
    stepId: resolution.stepId
  };
}

function createMiniAppHandlerIndex(
  handlers: Iterable<DiscoveredFlowStepHandlerModule> | undefined
): ReadonlyMap<string, DiscoveredFlowStepHandlerModule> {
  return new Map(
    Array.from(handlers ?? [], (handler) => [
      createMiniAppHandlerKey(handler.flowId, handler.stepId),
      handler
    ])
  );
}

function createMiniAppHandlerKey(flowId: string, stepId: string): string {
  return `${flowId}:${stepId}`;
}

function resolveMiniAppTransition(
  resolution: ResolvedMiniAppScreen | ReadyMiniAppScreen,
  result: void | FlowTransitionResult<unknown> | unknown,
  currentStepId: string,
  action?: FlowActionDefinition<unknown, unknown>
): MiniAppStepExecutionResult {
  const nextState = resolveNextState(resolution.state, result);
  const nextStepId = resolveNextStepId(currentStepId, action, result);
  const nextStep = getFlowStep(resolution.flow, nextStepId);

  if (!isMiniAppStep(nextStep)) {
    return {
      flow: resolution.flow,
      fromStepId: currentStepId,
      state: nextState,
      stepId: nextStepId,
      target: "chat"
    };
  }

  return {
    flow: resolution.flow,
    fromStepId: currentStepId,
    routePath: resolveMiniAppRoutePath(resolution.flow, nextStepId),
    screenId: nextStep.screen,
    state: nextState,
    stepId: nextStepId,
    target: "miniapp"
  };
}

function resolveMiniAppRoutePath(flow: AnyFlowDefinition, stepId: string): string {
  const stepRoute = flow.miniApp?.stepRoutes?.[stepId];

  if (typeof stepRoute === "string" && stepRoute.length > 0) {
    return stepRoute;
  }

  if (flow.miniApp?.route) {
    return flow.miniApp.route;
  }

  throw new Error(`Flow "${flow.id}" does not define a Mini App route for step "${stepId}".`);
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
  action: FlowActionDefinition<TState, unknown> | undefined,
  result: void | FlowTransitionResult<TState> | unknown
): string {
  if (isFlowTransitionResult(result) && typeof result.to === "string" && result.to.length > 0) {
    return result.to;
  }

  return action?.to ?? currentStepId;
}

function isFlowTransitionResult<TState>(value: unknown): value is FlowTransitionResult<TState> {
  return typeof value === "object" && value !== null;
}

function DefaultMiniAppError(options: { error: UnresolvedMiniAppScreen }) {
  const { error } = options;

  switch (error.reason) {
    case "missing_route":
      return <div>Teleforge could not resolve a Mini App screen for "{error.pathname}".</div>;
    case "missing_screen":
      return (
        <div>
          Teleforge could not find screen "{error.screenId}" for flow "{error.flowId}" step "
          {error.stepId}".
        </div>
      );
    case "missing_miniapp_step":
      return (
        <div>
          Teleforge route "{error.pathname}" resolved to step "{error.stepId}", but that step is
          not a Mini App step.
        </div>
      );
  }
}

function createUnresolvedRuntimeState(
  resolution: UnresolvedMiniAppScreen
): UnresolvedMiniAppRuntimeScreen {
  return {
    ...resolution,
    status: "unresolved"
  };
}

function DefaultMiniAppBlocked(options: { error: BlockedMiniAppScreen }) {
  const { error } = options;

  return (
    <div>
      Teleforge blocked screen "{error.screenId}" for flow "{error.flowId}".
      {error.block.reason ? ` ${error.block.reason}` : ""}
    </div>
  );
}

function DefaultMiniAppPending(options: { screenId?: string } = {}) {
  return <div>Loading Teleforge Mini App{options.screenId ? ` screen "${options.screenId}"` : ""}.</div>;
}

function DefaultMiniAppRuntimeError(options: { error: RuntimeErrorMiniAppScreen }) {
  const { error } = options;

  return (
    <div>
      Teleforge failed to initialize screen "{error.resolution.screenId}" for flow "
      {error.resolution.flowId}". {error.error.message}
    </div>
  );
}

function resolveWindowPathname(): string {
  if (typeof window === "undefined" || !window.location.pathname) {
    return "/";
  }

  return window.location.pathname;
}
