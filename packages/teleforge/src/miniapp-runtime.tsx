import { useLaunchCoordination } from "@teleforgex/web";
import { useEffect, useState } from "react";

import { resolveMiniAppScreen } from "./screens.js";

import type { DiscoveredFlowModule } from "./discovery.js";
import type { ActionFlowDefinition } from "./flow-definition.js";
import type { TeleforgeClientFlowManifest } from "./flow-manifest.js";
import type {
  DiscoveredScreenModule,
  ResolvedMiniAppScreen,
  TeleforgeScreenDefinition,
  TeleforgeScreenGuardBlock,
  UnresolvedMiniAppScreen
} from "./screens.js";
import type { TeleforgeActionServerBridge } from "./server-bridge.js";
import type { ActionResult, LaunchContext } from "@teleforgex/core";
import type { FlowContext } from "@teleforgex/core/browser";
import type { ReactNode } from "react";

type AnyFlowDefinition = ActionFlowDefinition;
type AnyScreenDefinition = TeleforgeScreenDefinition<any, any>;
type AnyDiscoveredScreenModule = DiscoveredScreenModule<any>;

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

  // Parse signed context subject as initial screen data
  const signedData = parseSignedContextSubject(launchCoordination.rawFlowContext);
  const screenData = signedData ?? screen.loaderData;

  return (
    <ScreenComponent
      launch={screen.launch ?? ({} as LaunchContext)}
      screenId={screen.screenId}
      routePath={screen.routePath}
      data={screenData}
      transitioning={isTransitioning}
      runAction={async (actionId: string, payload?: unknown): Promise<ActionResult> => {
        setIsTransitioning(true);

        try {
          if (props.serverBridge) {
            const result = await props.serverBridge.runAction({
              actionId,
              flowId: screen.flowId,
              payload,
              signedContext: launchCoordination.rawFlowContext ?? ""
            });

            if (result && typeof result === "object") {
              if ("navigate" in result && typeof result.navigate === "string") {
                setActivePathname(resolveScreenRoute(result.navigate, props.flowManifest));
              }
              if ("showHandoff" in result && (result as ActionResult).showHandoff) {
                handleShowHandoff(result as ActionResult, setHandoff, props);
              }
              return result as ActionResult;
            }
          }

          return { data: {} };
        } finally {
          setIsTransitioning(false);
        }
      }}
      navigate={(screenIdOrRoute: string) => {
        setActivePathname(screenIdOrRoute);
      }}
    />
  );
}

export function useTeleforgeMiniAppRuntime(options: UseTeleforgeMiniAppRuntimeOptions): TeleforgeMiniAppRuntimeState {
  const launchCoordination = useLaunchCoordination();
  const pathname = options.pathname ?? resolveWindowPathname();

  const flows = options.flows ?? manifestToFlows(options.flowManifest);

  const resolution = resolveScreenWithStandaloneFallback(
    flows,
    options.screens,
    pathname,
    launchCoordination
  );

  if ("reason" in resolution) {
    return { ...resolution, status: "unresolved" as const };
  }

  const [state, setState] = useState<TeleforgeMiniAppRuntimeState>({
    ...resolution,
    status: "ready"
  });

  useEffect(() => {
    setState({
      ...resolution,
      status: "ready"
    });
  }, [pathname]);

  return state;
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
    const resolved = resolveMiniAppScreen({
      flows: [flow],
      pathname: route,
      screens
    });

    if (!("reason" in resolved)) {
      return resolved;
    }
  }

  return result;
}

function handleShowHandoff(
  result: ActionResult,
  setHandoff: (h: ChatHandoffMiniAppScreen) => void,
  props: TeleforgeMiniAppProps
) {
  const message = typeof result.showHandoff === "string" ? result.showHandoff : "Returning to chat...";
  setHandoff({ message, status: "chat_handoff" });

  if (result.closeMiniApp) {
    const tg = (window as unknown as Record<string, unknown>).Telegram as { WebApp?: { close: () => void } } | undefined;
    setTimeout(() => {
      tg?.WebApp?.close();
      props.onReturnToChat?.();
    }, 1500);
  }
}

function resolveWindowPathname(): string {
  if (typeof window !== "undefined") {
    return window.location.pathname;
  }
  return "/";
}

function manifestToFlows(
  manifest?: TeleforgeClientFlowManifest
): Array<{ id: string; miniApp?: { routes: Record<string, string>; defaultRoute?: string; title?: string } }> {
  if (!manifest?.flows) return [];
  return manifest.flows.map((f) => ({
    id: f.id,
    miniApp: f.miniApp
      ? {
          routes: f.miniApp.routes as Record<string, string>,
          defaultRoute: f.miniApp.defaultRoute,
          title: f.miniApp.title
        }
      : undefined
  }));
}

function parseSignedContextSubject(rawContext: string | null): Record<string, unknown> | undefined {
  if (!rawContext) return undefined;
  try {
    const parts = rawContext.split(".");
    if (parts.length < 3) return undefined;
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && "subject" in parsed && parsed.subject) {
      return parsed.subject as Record<string, unknown>;
    }
  } catch {
    // ignore parse errors
  }
  return undefined;
}

function resolveScreenRoute(screenId: string, manifest?: TeleforgeClientFlowManifest): string {
  if (!manifest?.flows) return "/" + screenId;
  for (const flow of manifest.flows) {
    if (flow.miniApp?.routes) {
      for (const [route, id] of Object.entries(flow.miniApp.routes)) {
        if (id === screenId) return route;
      }
    }
  }
  return "/" + screenId;
}

export function loadMiniAppScreenRuntime() {
  throw new Error("loadMiniAppScreenRuntime is deprecated. Use useTeleforgeMiniAppRuntime instead.");
}

export async function executeMiniAppStepSubmit() {
  throw new Error("executeMiniAppStepSubmit is deprecated. Use runAction instead.");
}

export async function executeMiniAppStepAction() {
  throw new Error("executeMiniAppStepAction is deprecated. Use runAction instead.");
}
