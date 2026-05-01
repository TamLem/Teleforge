import { useLaunchCoordination } from "@teleforgex/web";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MiniAppStateProvider, useAppState } from "./miniapp-state.js";
import {
  extractRouteParams,
  findRoutePattern,
  resolveMiniAppScreen,
  toHelperName,
  validateRouteParams
} from "./screens.js";

import type { DiscoveredFlowModule } from "./discovery.js";
import type { ActionFlowDefinition } from "./flow-definition.js";
import type { TeleforgeClientFlowManifest } from "./flow-manifest.js";
import type { MiniAppState } from "./miniapp-state.js";
import type {
  ActionHelpers,
  DiscoveredScreenModule,
  LoaderState,
  NavigationHelpers,
  ResolvedMiniAppScreen,
  TeleforgeScreenDefinition,
  TeleforgeScreenGuardBlock,
  UnresolvedMiniAppScreen
} from "./screens.js";
import type { TeleforgeActionServerBridge } from "./server-bridge.js";
import type { ActionResult } from "@teleforgex/core";
import type { FlowContext } from "@teleforgex/core/browser";
import type { ReactNode } from "react";

type AnyFlowDefinition = ActionFlowDefinition;
type AnyScreenDefinition = TeleforgeScreenDefinition;
type AnyDiscoveredScreenModule = DiscoveredScreenModule;

export type NavigateOptions = {
  params?: Record<string, string>;
  data?: Record<string, unknown>;
  replace?: boolean;
};

export interface ScreenProps {
  scopeData?: Record<string, unknown>;
  routeParams: Record<string, string>;
  routeData?: Record<string, unknown>;
  loader: LoaderState;
  loaderData?: unknown;
  appState: MiniAppState;
  actions: ActionHelpers;
  nav: NavigationHelpers;
  runAction: (actionId: string, payload?: unknown) => Promise<ActionResult>;
  navigate: (screenId: string, options?: NavigateOptions) => void;
  transitioning: boolean;
  screenId: string;
  routePath: string;
}

export type { LoaderState };

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
  | "fallback"
  | "loadingFallback"
  | "renderBlocked"
  | "renderChatHandoff"
  | "renderError"
  | "renderHandoff"
  | "renderRuntimeError"
> {
  flowManifest?: TeleforgeClientFlowManifest;
}

export interface ReadyMiniAppScreen extends ResolvedMiniAppScreen {
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
    () => props.pathname ?? resolveWindowPathname() ?? defaultRoute ?? "/"
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [handoff, setHandoff] = useState<ChatHandoffMiniAppScreen | null>(null);
  const [routeData, setRouteData] = useState<Record<string, unknown> | undefined>(undefined);
  const [loader, setLoader] = useState<LoaderState>({ status: "idle" });
  const loaderKeyRef = useRef<string>("");
  const [loaderReload, setLoaderReload] = useState(0);

  const resolution = useTeleforgeMiniAppRuntime({
    ...props,
    pathname: activePathname
  });

  const flowsNormalized = useMemo(
    () =>
      props.flows
        ? Array.from(props.flows).map((f) => ("flow" in f ? f.flow : f))
        : manifestToFlows(props.flowManifest),
    [props.flows, props.flowManifest]
  );

  const routeParams: Record<string, string> = useMemo(() => {
    if (resolution.status !== "ready") return {};
    const screen = resolution as ReadyMiniAppScreen;
    const pattern = findRoutePattern(screen.screenId, flowsNormalized, activePathname);
    return pattern ? extractRouteParams(pattern, activePathname) : {};
  }, [resolution.status, flowsNormalized, activePathname]);

  useEffect(() => {
    if (props.pathname) {
      setActivePathname(props.pathname);
      setHandoff(null);
    }
  }, [props.pathname]);

  useEffect(() => {
    if (resolution.status !== "ready" || !props.serverBridge) {
      return;
    }

    const screen = resolution as ReadyMiniAppScreen;
    const loaderKey = `${screen.flowId}:${screen.screenId}:${activePathname}:${launchCoordination.rawFlowContext ?? ""}:${loaderReload}`;
    if (loaderKey === loaderKeyRef.current) {
      return;
    }

    loaderKeyRef.current = loaderKey;
    setLoader({ status: "loading" });

    const pattern = findRoutePattern(screen.screenId, flowsNormalized, activePathname);
    const params = pattern ? extractRouteParams(pattern, activePathname) : {};

    const rawContext = launchCoordination.rawFlowContext;
    console.log("[teleforge] loader context:", {
      flowId: screen.flowId,
      screenId: screen.screenId,
      pathname: activePathname,
      hasContext: Boolean(rawContext),
      contextPrefix: rawContext?.slice(0, 30),
      params
    });

    let cancelled = false;
    props.serverBridge
      .loadScreenContext({
        flowId: screen.flowId,
        screenId: screen.screenId,
        signedContext: rawContext ?? "",
        params
      })
      .then((result) => {
        if (cancelled) return;
        if (result.loaderFound) {
          setLoader({ status: "ready", data: result.data });
        } else {
          setLoader({ status: "idle" });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setLoader({
          status: "error",
          error: error instanceof Error ? error : new Error(String(error))
        });
      });

    return () => {
      cancelled = true;
      loaderKeyRef.current = "";
    };
  }, [
    resolution.status,
    activePathname,
    props.serverBridge,
    launchCoordination.rawFlowContext,
    flowsNormalized,
    loaderReload
  ]);

  if (handoff) {
    return (
      <>
        {props.renderChatHandoff ? (
          props.renderChatHandoff(handoff)
        ) : (
          <div>Returning to chat...</div>
        )}
      </>
    );
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
    return (
      <>
        {props.renderRuntimeError ? (
          props.renderRuntimeError(resolution)
        ) : (
          <div>Error: {resolution.error.message}</div>
        )}
      </>
    );
  }

  const screen = resolution as ReadyMiniAppScreen;
  const ScreenComponent = screen.screen.component;
  const appState = useAppState();
  const scopeData = parseSignedContextSubject(launchCoordination.rawFlowContext);

  const navigateClient = useCallback(
    (screenId: string, options?: NavigateOptions) => {
      setRouteData(options?.data);
      const path = resolveRoute(screenId, options?.params, props.flowManifest);
      setActivePathname(path);
    },
    [props.flowManifest]
  );

  const runActionClosure = useCallback(
    async (actionId: string, payload?: unknown): Promise<ActionResult> => {
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
                setTimeout(() => setHandoff(null), 2000);
              }
            }

            if (result.redirect) {
              if (result.redirect.reason === "reload") {
                setLoaderReload((n) => n + 1);
              }
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
    },
    [
      screen.flowId,
      props.serverBridge,
      launchCoordination.rawFlowContext,
      props.onReturnToChat,
      navigateClient
    ]
  );

  const actions: ActionHelpers = useMemo(() => {
    // When booted from a flow manifest, screen.flow does not include action
    // handlers (they are server-only). Derive action IDs from the union of
    // per-screen action lists so the typed happy-path helpers exist at runtime.
    const actionIds = getFlowActionIds(screen.flow);
    const entries = actionIds.map((actionId) => [
      actionId,
      (payload?: unknown) => runActionClosure(actionId, payload)
    ]);
    return Object.freeze(Object.fromEntries(entries));
  }, [screen.flow, runActionClosure]);

  const nav: NavigationHelpers = useMemo(() => {
    const routes = screen.flow.miniApp?.routes ?? {};
    const screenToRoute = new Map<string, string>();
    const seenHelpers = new Map<string, string>();
    const entries: Array<
      [
        string,
        (params?: Record<string, string>, options?: { data?: Record<string, unknown> }) => void
      ]
    > = [];

    for (const [routePath, sid] of Object.entries(routes)) {
      if (screenToRoute.has(sid)) continue;
      screenToRoute.set(sid, routePath);

      const helperName = toHelperName(sid);
      const existing = seenHelpers.get(helperName);
      if (existing) {
        throw new Error(
          `Screen IDs "${existing}" and "${sid}" both normalize to helper name "${helperName}". Rename one to avoid collision.`
        );
      }
      seenHelpers.set(helperName, sid);

      entries.push([
        helperName,
        (params?: Record<string, string>, options?: { data?: Record<string, unknown> }) => {
          validateRouteParams(routePath, params);
          navigateClient(sid, { params, data: options?.data });
        }
      ]);
    }

    return Object.freeze(Object.fromEntries(entries));
  }, [screen.flow.miniApp?.routes, navigateClient]);

  const loaderData = loader.status === "ready" ? loader.data : undefined;

  return (
    <ScreenComponent
      scopeData={scopeData}
      routeParams={routeParams}
      routeData={routeData}
      loader={loader}
      loaderData={loaderData}
      appState={appState}
      actions={actions}
      nav={nav}
      runAction={runActionClosure}
      navigate={navigateClient}
      transitioning={isTransitioning}
      screenId={screen.screenId}
      routePath={screen.routePath}
    />
  );
}

export function useTeleforgeMiniAppRuntime(
  options: UseTeleforgeMiniAppRuntimeOptions
): TeleforgeMiniAppRuntimeState {
  const launchCoordination = useLaunchCoordination();
  const pathname = options.pathname ?? resolveWindowPathname() ?? "/";

  const resolution = useMemo(() => {
    const flows = options.flows ?? manifestToFlows(options.flowManifest);
    return resolveScreenWithStandaloneFallback(
      flows,
      options.screens,
      pathname,
      launchCoordination
    );
  }, [options.flows, options.screens, pathname, launchCoordination]);

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

  for (const [route, _screenId] of Object.entries(flow.miniApp.routes)) {
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
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// --- Helpers ---

function manifestToFlows(manifest?: TeleforgeClientFlowManifest): Array<{
  id: string;
  miniApp?: { routes: Record<string, string>; defaultRoute?: string; title?: string };
  screens?: Array<{ id: string; actions?: string[] }>;
}> {
  if (!manifest?.flows) return [];
  return manifest.flows.map((f) => ({
    id: f.id,
    miniApp: f.miniApp
      ? {
          routes: f.miniApp.routes as Record<string, string>,
          defaultRoute: f.miniApp.defaultRoute,
          title: f.miniApp.title
        }
      : undefined,
    screens: f.screens.map((s) => ({
      id: s.id,
      actions: s.actions ? [...s.actions] : undefined
    }))
  }));
}

type FlowWithManifestScreens = ActionFlowDefinition & {
  screens?: ReadonlyArray<{ actions?: ReadonlyArray<string> }>;
};

function getFlowActionIds(flow: ActionFlowDefinition): string[] {
  if (flow.actions) {
    return Object.keys(flow.actions);
  }
  const screens = (flow as FlowWithManifestScreens).screens ?? [];
  return [...new Set(screens.flatMap((screen) => screen.actions ?? []))];
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
  const tg = (window as unknown as Record<string, unknown>).Telegram as
    | { WebApp?: { close: () => void } }
    | undefined;
  setTimeout(() => {
    tg?.WebApp?.close();
    onReturnToChat?.();
  }, 1500);
}

function resolveWindowPathname(): string | null {
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    if (path !== "/") return path;
  }
  return null;
}
