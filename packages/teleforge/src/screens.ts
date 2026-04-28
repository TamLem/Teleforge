import type { DiscoveredFlowModule } from "./discovery.js";
import type { ActionFlowDefinition } from "./flow-definition.js";
import type { MiniAppState } from "./miniapp-state.js";
import type { ActionContextToken, ActionResult, LaunchContext } from "@teleforgex/core";
import type { ComponentType } from "react";

type AnyFlowDefinition = ActionFlowDefinition;
type AnyScreenDefinition = TeleforgeScreenDefinition;
type AnyDiscoveredScreenModule = DiscoveredScreenModule;
type MaybePromise<T> = Promise<T> | T;

export interface TeleforgeScreenComponentProps<TData = unknown, TSession = unknown> {
  /** Signed context subject data (immutable per session). Prefer launchData. */
  data?: TData;
  /** @deprecated Use launchData instead. */
  launch?: LaunchContext;
  /** Signed context subject data (immutable per session). */
  launchData?: Record<string, unknown>;
  /** Data carried from the last navigate() call. */
  routeData?: Record<string, unknown>;
  /** Server-loaded screen data. */
  loaderData?: unknown;
  /** Mini App-wide client session state. */
  appState?: MiniAppState;
  session?: TSession;
  runAction: (actionId: string, payload?: unknown) => Promise<ActionResult>;
  /** Navigate to a screen by ID, optionally passing params and data. */
  navigate: (screenIdOrRoute: string, paramsOrOptions?: Record<string, unknown>) => void;
  transitioning: boolean;
  screenId: string;
  routePath: string;
}

export type TeleforgeScreenRuntimeContext = TeleforgeScreenComponentProps;

export interface TeleforgeScreenGuardBlock {
  allow: false;
  reason?: string;
}

export type TeleforgeScreenGuardResult = boolean | TeleforgeScreenGuardBlock;

export interface TeleforgeScreenDefinition<TData = unknown, TLoaderData = unknown> {
  component: ComponentType<TeleforgeScreenComponentProps<TData>>;
  guard?: (
    context: TeleforgeScreenComponentProps<TData>
  ) => MaybePromise<TeleforgeScreenGuardResult>;
  id: string;
  loader?: (context: TeleforgeScreenComponentProps<TData>) => MaybePromise<TLoaderData>;
  title?: string;
}

export interface DiscoveredScreenModule<TData = unknown> {
  filePath: string;
  screen: TeleforgeScreenDefinition<TData>;
}

export interface ResolveMiniAppScreenOptions {
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>;
  pathname: string;
  screens: Iterable<AnyScreenDefinition | AnyDiscoveredScreenModule>;
}

export interface ResolvedMiniAppScreen {
  flow: AnyFlowDefinition;
  flowId: string;
  routePath: string;
  screen: AnyScreenDefinition;
  screenId: string;
  launch?: LaunchContext;
}

export interface UnresolvedMiniAppScreen {
  flow?: AnyFlowDefinition;
  flowId?: string;
  pathname: string;
  reason: "missing_route" | "missing_screen";
  screenId?: string;
}

export function defineScreen<TData>(
  screen: TeleforgeScreenDefinition<TData>
): Readonly<TeleforgeScreenDefinition<TData>> {
  if (typeof screen.id !== "string" || screen.id.trim().length === 0) {
    throw new Error("Screen id must be a non-empty string.");
  }

  if (typeof screen.component !== "function") {
    throw new Error(`Screen "${screen.id}" must define a component.`);
  }

  return Object.freeze({
    ...screen
  });
}

export function createScreenRegistry(
  screens: Iterable<AnyScreenDefinition | AnyDiscoveredScreenModule>
): ReadonlyMap<string, AnyScreenDefinition> {
  const registry = new Map<string, AnyScreenDefinition>();

  for (const entry of screens) {
    const screen = "screen" in entry ? entry.screen : entry;
    const existing = registry.get(screen.id);

    if (existing) {
      throw new Error(`Duplicate screen id "${screen.id}" discovered.`);
    }

    registry.set(screen.id, screen);
  }

  return registry;
}

export function resolveMiniAppScreen(
  options: ResolveMiniAppScreenOptions
): ResolvedMiniAppScreen | UnresolvedMiniAppScreen {
  const flows = normalizeDiscoveredFlows(options.flows);
  const registry = createScreenRegistry(options.screens);

  for (const flow of flows) {
    if (!flow.miniApp) {
      continue;
    }

    const screenId = resolveScreenIdFromPath(flow, options.pathname);

    if (!screenId) {
      continue;
    }

    const screen = registry.get(screenId);

    if (!screen) {
      return {
        flow,
        flowId: flow.id,
        pathname: options.pathname,
        reason: "missing_screen",
        screenId
      };
    }

    return {
      flow,
      flowId: flow.id,
      routePath: options.pathname,
      screen,
      screenId: screen.id
    };
  }

  return {
    pathname: options.pathname,
    reason: "missing_route"
  };
}

export function createRouteRegistry(
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>
): ReadonlyMap<string, { flowId: string; screenId: string }> {
  const routes = new Map<string, { flowId: string; screenId: string }>();

  for (const entry of flows) {
    const flow = "flow" in entry ? entry.flow : entry;

    if (!flow.miniApp) {
      continue;
    }

    for (const [route, screenId] of Object.entries(flow.miniApp.routes)) {
      if (routes.has(route)) {
        throw new Error(
          `Duplicate Mini App route "${route}" discovered across flows.`
        );
      }

      routes.set(route, { flowId: flow.id, screenId });
    }
  }

  return routes;
}

function normalizeDiscoveredFlows(
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>
): AnyFlowDefinition[] {
  return Array.from(flows, (entry) => ("flow" in entry ? entry.flow : entry));
}

function resolveScreenIdFromPath(
  flow: AnyFlowDefinition,
  pathname: string
): string | null {
  const routes = flow.miniApp?.routes;
  if (!routes) return null;

  if (routes[pathname]) {
    return routes[pathname];
  }

  for (const [route, screenId] of Object.entries(routes)) {
    if (routePatternMatches(route, pathname)) {
      return screenId;
    }
  }

  return null;
}

export interface ServerLoaderContext {
  ctx: ActionContextToken;
  params: Record<string, string>;
  services: unknown;
}

export type LoaderRegistry = ReadonlyMap<string, (ctx: ServerLoaderContext) => Promise<unknown>>;

function routePatternMatches(pattern: string, pathname: string): boolean {
  if (!pattern.includes(":")) {
    return pattern === pathname;
  }

  const patternParts = pattern.split("/").filter(Boolean);
  const pathnameParts = pathname.split("/").filter(Boolean);

  if (patternParts.length !== pathnameParts.length) {
    return false;
  }

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      continue;
    }

    if (patternParts[i] !== pathnameParts[i]) {
      return false;
    }
  }

  return true;
}

type RouteFlowLike = { id: string; miniApp?: { routes: Record<string, string> } };

export function findRoutePattern(
  screenId: string,
  flows: Iterable<RouteFlowLike>
): string | null {
  for (const flow of flows) {
    if (!flow.miniApp?.routes) continue;
    for (const [route, id] of Object.entries(flow.miniApp.routes)) {
      if (id === screenId) return route;
    }
  }
  return null;
}
