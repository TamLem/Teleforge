import { useLaunchCoordination } from "@teleforgex/web";
import { useEffect, useMemo, useState } from "react";

import { findRoutePattern, resolveMiniAppScreen } from "./screens.js";
import { MiniAppStateProvider, useAppState } from "./miniapp-state.js";

import type { DiscoveredFlowModule } from "./discovery.js";
import type { ActionFlowDefinition } from "./flow-definition.js";
import type { TeleforgeClientFlowManifest } from "./flow-manifest.js";
import type { MiniAppState } from "./miniapp-state.js";
import type {
  DiscoveredScreenModule,
  ResolvedMiniAppScreen,
  TeleforgeScreenDefinition,
  TeleforgeScreenGuardBlock,
  UnresolvedMiniAppScreen
} from "./screens.js";
import type { TeleforgeActionServerBridge } from "./server-bridge.js";
import type { ActionResult, ClientEffect, LaunchContext } from "@teleforgex/core";
import type { FlowContext } from "@teleforgex/core/browser";
import type { ReactNode } from "react";

type AnyFlowDefinition = ActionFlowDefinition;
type AnyScreenDefinition = TeleforgeScreenDefinition<any, any>;
type AnyDiscoveredScreenModule = DiscoveredScreenModule<any>;

export type NavigateOptions = {
  params?: Record<string, string>;
  data?: Record<string, unknown>;
  replace?: boolean;
};

export interface ScreenProps {
  launchData?: Record<string, unknown>;
  routeData?: Record<string, unknown>;
  loaderData?: unknown;
  appState: MiniAppState;
  runAction: <TResult = unknown>(actionId: string, payload?: unknown) => Promise<ActionResult>;
  navigate: (screenId: string, options?: NavigateOptions) => void;
  transitioning: boolean;
  screenId: string;
  routePath: string;
}

export interface TeleforgeMiniAppProps {
  fallback?: ReactNode;
  flowManifest?: TeleforgeClientFlowManifest;
  flows?: Iterable<AnyFlowDefinition | DiscoveredFlowModule>;
  loadingFallback?: ReactNode;
  onReturnToChat?: () => void | Promise<void>;
  pathname?: string;
  renderBlocked?: (error: BlockedMiniAppScreen) => ReactNode;
  renderError?: (error: UnresolvedMiniAppScreen) => ReactNode;
  renderRuntimeError?: (error: RuntimeErrorMiniAppScreen) => ReactNode;
  renderChatHandoff?: (result: ChatHandoffMiniAppScreen) => ReactNode;
  screens: Iterable<AnyScreenDefinition | AnyDiscoveredScreenModule>;
  serverBridge?: TeleforgeActionServerBridge;
}

export interface UseTeleforgeMiniAppRuntimeOptions extends Omit<
  TeleforgeMiniAppProps,
  "fallback" | "loadingFallback" | "renderBlocked" | "renderChatHandoff" | "renderError" | "renderHandoff" | "renderRuntimeError"
> {
  flowManifest?: TeleforgeClientFlowManifest;
}

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
  message: string;
  status: "chat_handoff";
}

export type TeleforgeMiniAppRuntimeState =
  | ReadyMiniAppScreen
  | BlockedMiniAppScreen
  | PendingMiniAppScreen
  | RuntimeErrorMiniAppScreen
  | UnresolvedMiniAppRuntimeScreen;

export { MiniAppStateProvider, useAppState } from "./miniapp-state.js";
export type { MiniAppState } from "./miniapp-state.js";

export function TeleforgeMiniApp(props: TeleforgeMiniAppProps) {
  return (
    <MiniAppStateProvider>
      <TeleforgeMiniAppInner {...props} />
    </MiniAppStateProvider>
  );
}

function TeleforgeMiniAppInner(props: TeleforgeMiniAppProps) {
  const launchCoordination = useLaunchCoordination();
  const defaultRoute = parseEntryRoute(launchCoordination, props.flowManifest);
  const [activePathname, setActivePathname] = useState(
    () => props.pathname ?? defaultRoute ?? resolveWindowPathname()
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [handoff, setHandoff] = useState<ChatHandoffMiniAppScreen | null>(null);
  const [routeData, setRouteData] = useState<Record<string, unknown> | undefined>(undefined);

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

  if (handoff) {
    return <>{props.renderChatHandoff ? props.renderChatHandoff(handoff) : <div>Returning to chat...</div>}</>;
  }

  if (resolution.status === "pending") {
    return <>{props.loadingFallback ?? <div>Loading...</div>}</>;
  }

  if (resolution.status === "unresolved") {
    return <>{props.renderError ? props.renderError(resolution) : <div>Screen not found</div>}</>;
  }

  if (resolution.status === "blocked") {
    return <>{props.renderBlocked ? props.renderBlocked(resolution) : <div>Access denied</div>}</>;
  }

  if (resolution.status === "runtime_error") {
    return <>{props.renderRuntimeError ? props.renderRuntimeError(resolution) : <div>Error: {resolution.error.message}</div>}</>;
  }

  const screen = resolution as ReadyMiniAppScreen;
  const ScreenComponent = screen.screen.component;
  const appState = useAppState();
  const signedData = parseSignedContextSubject(launchCoordination.rawFlowContext);
  // Merge: routeData (from navigate) takes priority, signedData (from chat link) is baseline
  const screenData = routeData
    ? { ...signedData, ...routeData }
    : signedData;

  const navigateClient = (screenId: string, options?: NavigateOptions) => {
    setRouteData(options?.data);
    const path = resolveRoute(screenId, options?.params, props.flowManifest);
    setActivePathname(path);
  };

  const runActionClosure = async (actionId: string, payload?: unknown): Promise<ActionResult> => {
    setIsTransitioning(true);
    try {
      if (props.serverBridge) {
        const result = await props.serverBridge.runAction({
          actionId,
          flowId: screen.flowId,
          payload,
          signedContext: launchCoordination.rawFlowContext ?? ""
        });

        if (result) {
          applyClientEffects(result.clientEffects);

          if (result.handoff) {
            setHandoff({
              message: result.handoff.message ?? "Returning to chat...",
              status: "chat_handoff"
            });
            if (result.handoff.closeMiniApp) {
              scheduleClose(props.onReturnToChat);
            } else {
              // Dismiss non-close handoff after a short delay
              setTimeout(() => setHandoff(null), 2000);
            }
          }

          // Legacy compat: old showHandoff/closeMiniApp top-level fields
          if (result.showHandoff && !result.handoff) {
            setHandoff({
              message: typeof result.showHandoff === "string" ? result.showHandoff : "Returning to chat...",
              status: "chat_handoff"
            });
            if (result.closeMiniApp) {
              scheduleClose(props.onReturnToChat);
            }
          }

          if (result.redirect) {
            navigateClient(result.redirect.screenId, {
              params: result.redirect.params,
              data: result.redirect.data,
              replace: true
            });
          }

          return result;
        }
      }
      return { data: {} };
    } finally {
      setIsTransitioning(false);
    }
  };

  return (
    <ScreenComponent
      data={screenData}
      launchData={signedData}
      routeData={routeData}
      loaderData={screen.loaderData}
      appState={appState}
      runAction={runActionClosure}
      navigate={navigateClient}
      transitioning={isTransitioning}
      screenId={screen.screenId}
      routePath={screen.routePath}
    />
  );
}

export function useTeleforgeMiniAppRuntime(options: UseTeleforgeMiniAppRuntimeOptions): TeleforgeMiniAppRuntimeState {
  const launchCoordination = useLaunchCoordination();
  const pathname = options.pathname ?? resolveWindowPathname();

  const resolution = useMemo(
    () => {
      const flows = options.flows ?? manifestToFlows(options.flowManifest);
      return resolveScreenWithStandaloneFallback(flows, options.screens, pathname, launchCoordination);
    },
    [options.flows, options.screens, pathname, launchCoordination]
  );

  if ("reason" in resolution) {
    return { ...resolution, status: "unresolved" as const };
  }

  return { ...resolution, status: "ready" as const };
}

function resolveScreenWithStandaloneFallback(
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>,
  screens: Iterable<AnyScreenDefinition | AnyDiscoveredScreenModule>,
  pathname: string,
  launchCoordination: { flowContext: FlowContext | null; stateKey: string | null }
): ResolvedMiniAppScreen | UnresolvedMiniAppScreen {
  const result = resolveMiniAppScreen({ flows, pathname, screens });

  if (!("reason" in result)) {
    return result;
  }

  if (launchCoordination.flowContext || launchCoordination.stateKey) {
    return result;
  }

  if (result.reason !== "missing_screen") {
    return result;
  }

  const flow = result.flow;
  if (!flow?.miniApp?.routes) {
    return result;
  }

  for (const [route, screenId] of Object.entries(flow.miniApp.routes)) {
    const resolved = resolveMiniAppScreen({ flows: [flow], pathname: route, screens });
    if (!("reason" in resolved)) {
      return resolved;
    }
  }

  return result;
}

// --- Route resolution ---

function resolveRoute(
  screenId: string,
  params: Record<string, string> | undefined,
  manifest?: TeleforgeClientFlowManifest
): string {
  const flows = manifestToFlows(manifest);
  const pattern = findRoutePattern(screenId, flows);

  if (!pattern) {
    return `/${encodeURIComponent(screenId)}`;
  }

  return pattern.replace(/:(\w+)/g, (_, key) => {
    const value = params?.[key];
    if (!value) {
      console.error(`[teleforge] missing route param '${key}' for screen '${screenId}'`);
      return `:${key}`;
    }
    return encodeURIComponent(value);
  });
}

// --- Signed context parsing ---

function parseSignedContextSubject(rawContext: string | null): Record<string, unknown> | undefined {
  if (!rawContext) return undefined;
  try {
    const payload = parseTfp2Payload(rawContext);
    if (payload && typeof payload === "object" && "subject" in payload && payload.subject) {
      return payload.subject as Record<string, unknown>;
    }
  } catch {
    // ignore parse errors
  }
  return undefined;
}

function parseEntryRoute(
  launch: { rawFlowContext: string | null; entryRoute: string | null },
  manifest?: TeleforgeClientFlowManifest
): string | null {
  if (launch.entryRoute) return launch.entryRoute;
  const rawContext = launch.rawFlowContext;
  if (!rawContext || !manifest?.flows) return null;

  const payload = parseTfp2Payload(rawContext);
  if (!payload || typeof payload.screenId !== "string") return null;

  for (const flow of manifest.flows) {
    if (flow.miniApp?.routes) {
      for (const [route, screenId] of Object.entries(flow.miniApp.routes)) {
        if (screenId === payload.screenId) return route;
      }
    }
  }
  return null;
}

function parseTfp2Payload(rawContext: string): Record<string, unknown> | null {
  if (!rawContext.startsWith("tfp2.")) return null;
  const parts = rawContext.split(".");
  if (parts.length < 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

// --- Helpers ---

function manifestToFlows(
  manifest?: TeleforgeClientFlowManifest
): Array<{ id: string; miniApp?: { routes: Record<string, string>; defaultRoute?: string; title?: string } }> {
  if (!manifest?.flows) return [];
  return manifest.flows.map((f) => ({
    id: f.id,
    miniApp: f.miniApp
      ? { routes: f.miniApp.routes as Record<string, string>, defaultRoute: f.miniApp.defaultRoute, title: f.miniApp.title }
      : undefined
  }));
}

function applyClientEffects(effects?: Array<{ type: string; message?: string }>) {
  if (!effects) return;
  for (const effect of effects) {
    switch (effect.type) {
      case "toast":
        if (effect.message) console.log("[teleforge:toast]", effect.message);
        break;
    }
  }
}

function scheduleClose(onReturnToChat?: () => void | Promise<void>) {
  const tg = (window as unknown as Record<string, unknown>).Telegram as { WebApp?: { close: () => void } } | undefined;
  setTimeout(() => {
    tg?.WebApp?.close();
    onReturnToChat?.();
  }, 1500);
}

function resolveWindowPathname(): string {
  if (typeof window !== "undefined") {
    return window.location.pathname;
  }
  return "/";
}

// --- Deprecated shims ---

export function loadMiniAppScreenRuntime() {
  throw new Error("loadMiniAppScreenRuntime is deprecated. Use useTeleforgeMiniAppRuntime instead.");
}

export async function executeMiniAppStepSubmit() {
  throw new Error("executeMiniAppStepSubmit is deprecated. Use runAction instead.");
}

export async function executeMiniAppStepAction() {
  throw new Error("executeMiniAppStepAction is deprecated. Use runAction instead.");
}
