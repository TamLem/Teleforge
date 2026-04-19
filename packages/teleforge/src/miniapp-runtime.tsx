import { useLaunchCoordination } from "@teleforgex/web";
import { useEffect, useState } from "react";

import { getFlowStep, isMiniAppStep, resolveFlowActionKey } from "./flow.js";
import { resolveMiniAppScreen } from "./screens.js";
import {
  executeTeleforgeServerHookAction,
  executeTeleforgeServerHookLoad,
  executeTeleforgeServerHookSubmit
} from "./server-hooks.js";

import type {
  DiscoveredFlowModule,
  DiscoveredFlowStepHandlerModule,
  DiscoveredFlowStepServerHookModule
} from "./discovery.js";
import type { FlowActionDefinition, FlowTransitionResult, TeleforgeFlowDefinition } from "./flow.js";
import type {
  DiscoveredScreenModule,
  ResolvedMiniAppScreen,
  TeleforgeScreenDefinition,
  TeleforgeScreenGuardBlock,
  TeleforgeScreenRuntimeContext,
  UnresolvedMiniAppScreen
} from "./screens.js";
import type { TeleforgeMiniAppServerBridge } from "./server-hooks.js";
import type { ReactNode } from "react";

type AnyFlowDefinition = TeleforgeFlowDefinition<unknown, unknown>;

export interface TeleforgeMiniAppProps {
  fallback?: ReactNode;
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>;
  loadingFallback?: ReactNode;
  onReturnToChat?: (result: ChatMiniAppTransitionResult) => void | Promise<void>;
  pathname?: string;
  renderBlocked?: (error: BlockedMiniAppScreen) => ReactNode;
  renderChatHandoff?: (result: ChatHandoffMiniAppScreen) => ReactNode;
  renderError?: (error: UnresolvedMiniAppScreen) => ReactNode;
  renderRuntimeError?: (error: RuntimeErrorMiniAppScreen) => ReactNode;
  screens: Iterable<TeleforgeScreenDefinition | DiscoveredScreenModule>;
  serverBridge?: TeleforgeMiniAppServerBridge;
  serverHooks?: Iterable<DiscoveredFlowStepServerHookModule>;
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

export interface ChatHandoffMiniAppScreen {
  result: ChatMiniAppTransitionResult;
  status: "chat_handoff";
}

export interface ExecuteMiniAppStepSubmitOptions<TData = unknown> {
  data: TData;
  handlers?: Iterable<DiscoveredFlowStepHandlerModule>;
  resolution: ResolvedMiniAppScreen | ReadyMiniAppScreen;
  serverBridge?: TeleforgeMiniAppServerBridge;
  serverHooks?: Iterable<DiscoveredFlowStepServerHookModule>;
  stateKey?: string | null;
  services?: unknown;
}

export interface ExecuteMiniAppStepActionOptions {
  action: string;
  handlers?: Iterable<DiscoveredFlowStepHandlerModule>;
  resolution: ResolvedMiniAppScreen | ReadyMiniAppScreen;
  serverBridge?: TeleforgeMiniAppServerBridge;
  serverHooks?: Iterable<DiscoveredFlowStepServerHookModule>;
  stateKey?: string | null;
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

interface PersistedMiniAppSnapshot {
  flowId: string;
  routePath: string;
  state: unknown;
  stepId: string;
  updatedAt: number;
}

const MINI_APP_CHAT_HANDOFF_TYPE = "teleforge_flow_handoff";
const MINI_APP_SNAPSHOT_PREFIX = "teleforge:miniapp:";

export function TeleforgeMiniApp(props: TeleforgeMiniAppProps) {
  const launchCoordination = useLaunchCoordination();
  const [activePathname, setActivePathname] = useState(
    () => props.pathname ?? launchCoordination.entryRoute ?? resolveWindowPathname()
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [handoff, setHandoff] = useState<ChatHandoffMiniAppScreen | null>(null);
  const resolution = useTeleforgeMiniAppRuntime({
    ...props,
    pathname: activePathname
  });

  useEffect(() => {
    if (props.pathname) {
      setActivePathname(props.pathname);
      setHandoff(null);
    }
  }, [props.pathname]);

  useEffect(() => {
    if (resolution.status === "ready") {
      persistMiniAppSnapshot(launchCoordination.stateKey, {
        flowId: resolution.flowId,
        routePath: resolution.routePath,
        state: resolution.state,
        stepId: resolution.stepId,
        updatedAt: Date.now()
      });
    }
  }, [launchCoordination.stateKey, resolution]);

  if (handoff) {
    if (props.renderChatHandoff) {
      return <>{props.renderChatHandoff(handoff)}</>;
    }

    return <DefaultMiniAppChatHandoff result={handoff.result} />;
  }

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
      runAction={(action: string) =>
        handleMiniAppAction({
          action,
          flowContext: launchCoordination.rawFlowContext,
          onReturnToChat: props.onReturnToChat,
          resolution,
          serverBridge: props.serverBridge,
          serverHooks: props.serverHooks,
          stateKey: launchCoordination.stateKey,
          setActivePathname,
          setHandoff,
          setIsTransitioning
        })
      }
      routePath={resolution.routePath}
      screenId={resolution.screenId}
      state={resolution.state}
      stepId={resolution.stepId}
      submit={(data: unknown) =>
        handleMiniAppSubmit({
          data,
          flowContext: launchCoordination.rawFlowContext,
          onReturnToChat: props.onReturnToChat,
          resolution,
          serverBridge: props.serverBridge,
          serverHooks: props.serverHooks,
          stateKey: launchCoordination.stateKey,
          setActivePathname,
          setHandoff,
          setIsTransitioning
        })
      }
      transitioning={isTransitioning}
    />
  );
}

export function useTeleforgeMiniAppRuntime(
  options: UseTeleforgeMiniAppRuntimeOptions
): TeleforgeMiniAppRuntimeState {
  const launchCoordination = useLaunchCoordination();
  const pathname = options.pathname ?? resolveWindowPathname();
  const [state, setState] = useState<TeleforgeMiniAppRuntimeState>(() => {
    const resolution = applyPersistedMiniAppSnapshot(
      resolveMiniAppScreen({
        flows: options.flows,
        pathname,
        screens: options.screens
      }),
      readPersistedMiniAppSnapshot(launchCoordination.stateKey)
    );

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
    const resolution = applyPersistedMiniAppSnapshot(
      resolveMiniAppScreen({
        flows: options.flows,
        pathname,
        screens: options.screens
      }),
      readPersistedMiniAppSnapshot(launchCoordination.stateKey)
    );

    if ("reason" in resolution) {
      setState(createUnresolvedRuntimeState(resolution));
      return;
    }

    setState({
      resolution,
      status: "pending"
    });

    loadMiniAppScreenRuntime(resolution, {
      serverBridge: options.serverBridge,
      serverHooks: options.serverHooks,
      stateKey: launchCoordination.stateKey
    })
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
  }, [launchCoordination.rawFlowContext, launchCoordination.stateKey, options.flows, pathname, options.screens]);

  return state;
}

export async function loadMiniAppScreenRuntime(
  resolution: ResolvedMiniAppScreen,
  options: {
    serverBridge?: TeleforgeMiniAppServerBridge;
    serverHooks?: Iterable<DiscoveredFlowStepServerHookModule>;
    stateKey?: string | null;
    services?: unknown;
  } = {}
): Promise<ReadyMiniAppScreen | BlockedMiniAppScreen> {
  const serverResult = options.serverBridge
    ? await options.serverBridge.load({
        flowId: resolution.flowId,
        routePath: resolution.routePath,
        screenId: resolution.screenId,
        state: resolution.state,
        ...(options.stateKey ? { stateKey: options.stateKey } : {}),
        stepId: resolution.stepId
      })
    : await executeTeleforgeServerHookLoad({
        flow: resolution.flow,
        hooks: options.serverHooks,
        input: {
          flowId: resolution.flowId,
          routePath: resolution.routePath,
          screenId: resolution.screenId,
          state: resolution.state,
          ...(options.stateKey ? { stateKey: options.stateKey } : {}),
          stepId: resolution.stepId
        },
        services: options.services
      });
  const nextResolution = {
    ...resolution,
    ...(serverResult.state !== undefined ? { state: serverResult.state } : {})
  };

  if (!serverResult.allow) {
    return {
      ...nextResolution,
      block: serverResult.block,
      status: "blocked"
    };
  }

  const context = createRuntimeContext(nextResolution, serverResult.loaderData);
  const guardResult = resolution.screen.guard
    ? await resolution.screen.guard(context)
    : true;

  if (guardResult !== true) {
    if (guardResult === false) {
      return {
        ...nextResolution,
        block: {
          allow: false
        },
        status: "blocked"
      };
    }

    return {
      ...nextResolution,
      block: guardResult,
      status: "blocked"
    };
  }

  return {
    ...nextResolution,
    ...((nextResolution.screen.loader ?? resolution.screen.loader)
      ? {
          loaderData: await (nextResolution.screen.loader ?? resolution.screen.loader)?.(context)
        }
      : serverResult.loaderData !== undefined
        ? {
            loaderData: serverResult.loaderData
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
  const result = options.serverBridge
    ? await options.serverBridge.submit({
        data: options.data,
        flowId: options.resolution.flowId,
        state: options.resolution.state,
        ...(options.stateKey ? { stateKey: options.stateKey } : {}),
        stepId: options.resolution.stepId
      })
    : options.serverHooks
      ? await executeTeleforgeServerHookSubmit({
          flow: options.resolution.flow,
          hooks: options.serverHooks,
          input: {
            data: options.data,
            flowId: options.resolution.flowId,
            state: options.resolution.state,
            ...(options.stateKey ? { stateKey: options.stateKey } : {}),
            stepId: options.resolution.stepId
          },
          services: options.services
        })
      : await resolveMiniAppSubmitResult({
          data: options.data,
          handlerModule,
          resolution: options.resolution,
          services: options.services,
          step
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
  const result = options.serverBridge
    ? await options.serverBridge.action({
        action: options.action,
        flowId: options.resolution.flowId,
        state: options.resolution.state,
        ...(options.stateKey ? { stateKey: options.stateKey } : {}),
        stepId: options.resolution.stepId
      })
    : options.serverHooks
      ? await executeTeleforgeServerHookAction({
          flow: options.resolution.flow,
          hooks: options.serverHooks,
          input: {
            action: options.action,
            flowId: options.resolution.flowId,
            state: options.resolution.state,
            ...(options.stateKey ? { stateKey: options.stateKey } : {}),
            stepId: options.resolution.stepId
          },
          services: options.services
        })
      : await resolveMiniAppActionResult({
          action: options.action,
          actionDefinition,
          handlerModule,
          resolution: options.resolution,
          services: options.services
        });

  return resolveMiniAppTransition(options.resolution, result, options.resolution.stepId, actionDefinition);
}

async function handleMiniAppSubmit(options: {
  data: unknown;
  flowContext: string | null;
  onReturnToChat?: TeleforgeMiniAppProps["onReturnToChat"];
  resolution: ReadyMiniAppScreen;
  serverBridge?: TeleforgeMiniAppServerBridge;
  serverHooks?: Iterable<DiscoveredFlowStepServerHookModule>;
  stateKey: string | null;
  setActivePathname: (pathname: string) => void;
  setHandoff: (value: ChatHandoffMiniAppScreen | null) => void;
  setIsTransitioning: (value: boolean) => void;
}): Promise<void> {
  options.setIsTransitioning(true);

  try {
    const result = await executeMiniAppStepSubmit({
      data: options.data,
      resolution: options.resolution,
      serverBridge: options.serverBridge,
      serverHooks: options.serverHooks,
      stateKey: options.stateKey
    });

    await applyMiniAppExecutionResult({
      flowContext: options.flowContext,
      onReturnToChat: options.onReturnToChat,
      result,
      stateKey: options.stateKey,
      setActivePathname: options.setActivePathname,
      setHandoff: options.setHandoff
    });
  } finally {
    options.setIsTransitioning(false);
  }
}

async function handleMiniAppAction(options: {
  action: string;
  flowContext: string | null;
  onReturnToChat?: TeleforgeMiniAppProps["onReturnToChat"];
  resolution: ReadyMiniAppScreen;
  serverBridge?: TeleforgeMiniAppServerBridge;
  serverHooks?: Iterable<DiscoveredFlowStepServerHookModule>;
  stateKey: string | null;
  setActivePathname: (pathname: string) => void;
  setHandoff: (value: ChatHandoffMiniAppScreen | null) => void;
  setIsTransitioning: (value: boolean) => void;
}): Promise<void> {
  options.setIsTransitioning(true);

  try {
    const result = await executeMiniAppStepAction({
      action: options.action,
      resolution: options.resolution,
      serverBridge: options.serverBridge,
      serverHooks: options.serverHooks,
      stateKey: options.stateKey
    });

    await applyMiniAppExecutionResult({
      flowContext: options.flowContext,
      onReturnToChat: options.onReturnToChat,
      result,
      stateKey: options.stateKey,
      setActivePathname: options.setActivePathname,
      setHandoff: options.setHandoff
    });
  } finally {
    options.setIsTransitioning(false);
  }
}

async function applyMiniAppExecutionResult(options: {
  flowContext: string | null;
  onReturnToChat?: TeleforgeMiniAppProps["onReturnToChat"];
  result: MiniAppStepExecutionResult;
  stateKey: string | null;
  setActivePathname: (pathname: string) => void;
  setHandoff: (value: ChatHandoffMiniAppScreen | null) => void;
}): Promise<void> {
  if (options.result.target === "miniapp") {
    persistMiniAppSnapshot(options.stateKey, {
      flowId: options.result.flow.id,
      routePath: options.result.routePath,
      state: options.result.state,
      stepId: options.result.stepId,
      updatedAt: Date.now()
    });
    options.setHandoff(null);
    syncBrowserPathname(options.result.routePath);
    options.setActivePathname(options.result.routePath);
    return;
  }

  clearPersistedMiniAppSnapshot(options.stateKey);
  const transmitted = await transmitMiniAppChatHandoff({
    flowContext: options.flowContext,
    result: options.result,
    stateKey: options.stateKey
  });
  await options.onReturnToChat?.(options.result);
  options.setHandoff({
    result: options.result,
    status: "chat_handoff"
  });

  if (transmitted) {
    closeTelegramMiniApp();
  }
}

function createRuntimeContext(
  resolution: ResolvedMiniAppScreen,
  serverLoaderData?: unknown
): TeleforgeScreenRuntimeContext<unknown> {
  return {
    flow: resolution.flow,
    flowId: resolution.flowId,
    routePath: resolution.routePath,
    screenId: resolution.screenId,
    ...(serverLoaderData !== undefined ? { serverLoaderData } : {}),
    state: resolution.state,
    stepId: resolution.stepId
  };
}

async function resolveMiniAppSubmitResult(options: {
  data: unknown;
  handlerModule: DiscoveredFlowStepHandlerModule | undefined;
  resolution: ResolvedMiniAppScreen | ReadyMiniAppScreen;
  services?: unknown;
  step: ReturnType<typeof getFlowStep<unknown, unknown>>;
}): Promise<void | FlowTransitionResult<unknown>> {
  const onSubmit = isMiniAppStep(options.step)
    ? options.step.onSubmit ?? options.handlerModule?.onSubmit
    : undefined;

  if (!onSubmit) {
    throw new Error(
      `Flow "${options.resolution.flowId}" step "${options.resolution.stepId}" does not define an onSubmit handler.`
    );
  }

  return await onSubmit({
    data: options.data,
    flow: options.resolution.flow,
    services: options.services,
    state: options.resolution.state
  }) as void | FlowTransitionResult<unknown>;
}

async function resolveMiniAppActionResult(options: {
  action: string;
  actionDefinition: FlowActionDefinition<unknown, unknown> | undefined;
  handlerModule: DiscoveredFlowStepHandlerModule | undefined;
  resolution: ResolvedMiniAppScreen | ReadyMiniAppScreen;
  services?: unknown;
}): Promise<void | FlowTransitionResult<unknown>> {
  const actionHandler =
    options.actionDefinition?.handler ?? options.handlerModule?.actions[options.action] ?? undefined;

  if (!actionHandler && !options.actionDefinition?.to) {
    throw new Error(
      `Flow "${options.resolution.flowId}" step "${options.resolution.stepId}" action "${options.action}" is not wired.`
    );
  }

  return actionHandler
    ? await actionHandler({
        flow: options.resolution.flow,
        services: options.services,
        state: options.resolution.state
      }) as void | FlowTransitionResult<unknown>
    : undefined;
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

function applyPersistedMiniAppSnapshot(
  resolution: ResolvedMiniAppScreen | UnresolvedMiniAppScreen,
  snapshot: PersistedMiniAppSnapshot | null
): ResolvedMiniAppScreen | UnresolvedMiniAppScreen {
  if ("reason" in resolution || !snapshot) {
    return resolution;
  }

  if (snapshot.flowId !== resolution.flowId || snapshot.stepId !== resolution.stepId) {
    return resolution;
  }

  return {
    ...resolution,
    routePath: snapshot.routePath,
    state: structuredClone(snapshot.state)
  };
}

function readPersistedMiniAppSnapshot(stateKey: string | null): PersistedMiniAppSnapshot | null {
  if (!stateKey || typeof window === "undefined" || !window.sessionStorage) {
    return null;
  }

  const raw = window.sessionStorage.getItem(`${MINI_APP_SNAPSHOT_PREFIX}${stateKey}`);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PersistedMiniAppSnapshot;

    if (
      typeof parsed.flowId !== "string" ||
      typeof parsed.routePath !== "string" ||
      typeof parsed.stepId !== "string"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function persistMiniAppSnapshot(
  stateKey: string | null,
  snapshot: PersistedMiniAppSnapshot
): void {
  if (!stateKey || typeof window === "undefined" || !window.sessionStorage) {
    return;
  }

  window.sessionStorage.setItem(
    `${MINI_APP_SNAPSHOT_PREFIX}${stateKey}`,
    JSON.stringify(snapshot)
  );
}

function clearPersistedMiniAppSnapshot(stateKey: string | null): void {
  if (!stateKey || typeof window === "undefined" || !window.sessionStorage) {
    return;
  }

  window.sessionStorage.removeItem(`${MINI_APP_SNAPSHOT_PREFIX}${stateKey}`);
}

async function transmitMiniAppChatHandoff(options: {
  flowContext: string | null;
  result: ChatMiniAppTransitionResult;
  stateKey: string | null;
}): Promise<boolean> {
  if (
    !options.flowContext ||
    !options.stateKey ||
    typeof window === "undefined" ||
    typeof window.Telegram?.WebApp?.sendData !== "function"
  ) {
    return false;
  }

  window.Telegram.WebApp.sendData(
    JSON.stringify({
      flowContext: options.flowContext,
      state: options.result.state,
      stateKey: options.stateKey,
      stepId: options.result.stepId,
      type: MINI_APP_CHAT_HANDOFF_TYPE
    })
  );

  return true;
}

function closeTelegramMiniApp(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.Telegram?.WebApp?.close?.();
}

function syncBrowserPathname(pathname: string): void {
  if (typeof window === "undefined" || window.location.pathname === pathname) {
    return;
  }

  window.history.replaceState(window.history.state, "", pathname);
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

function DefaultMiniAppChatHandoff(options: { result: ChatMiniAppTransitionResult }) {
  return (
    <div>
      Teleforge is handing this flow back to chat at step "{options.result.stepId}".
    </div>
  );
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
