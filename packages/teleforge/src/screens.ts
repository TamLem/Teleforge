import type { DiscoveredFlowModule } from "./discovery.js";
import type { ActionFlowDefinition } from "./flow-definition.js";
import type { MiniAppState } from "./miniapp-state.js";
import type { ActionContextToken, ActionResult, SessionHandle, TeleforgeInputSchema } from "@teleforgex/core";
import type { ComponentType } from "react";

type AnyFlowDefinition = ActionFlowDefinition;
type AnyScreenDefinition = TeleforgeScreenDefinition;
type AnyDiscoveredScreenModule = DiscoveredScreenModule;
type MaybePromise<T> = Promise<T> | T;

export type LoaderState =
  | { status: "loading" }
  | { status: "ready"; data: unknown }
  | { status: "error"; error: Error }
  | { status: "idle" };

/**
 * Discriminated loader lifecycle with typed `data` in the ready state.
 *
 * Use this as the DX layer in generated per-screen prop aliases so
 * `loader.status === "ready"` narrows `loader.data` to the screen's
 * loader data type.
 */
export type TypedLoaderState<TData = unknown> =
  | { status: "loading" }
  | { status: "ready"; data: TData }
  | { status: "error"; error: Error }
  | { status: "idle" };

export type ActionHelpers<TActionId extends string = string> = Readonly<
  Record<TActionId, (payload?: unknown) => Promise<ActionResult>>
>;

/**
 * Strongly-typed action helper map keyed by action ID.
 *
 * Each value of `TPayloads[ActionId]` describes the payload accepted
 * by that action. Use `unknown` for permissive payloads or a concrete
 * shape for typed payloads. Use `undefined` for actions that take no
 * payload at all.
 *
 * Example:
 *
 * ```ts
 * type Payloads = {
 *   addToCart: { productId: string; qty: number };
 *   placeOrder: undefined;
 *   refresh: unknown;
 * };
 *
 * const actions: TypedActionHelpers<Payloads> = ...;
 * actions.addToCart({ productId: "x", qty: 1 });
 * actions.placeOrder();
 * actions.refresh(anything);
 * ```
 */
export type TypedActionHelpers<TPayloads extends Record<string, unknown>> = Readonly<{
  [TActionId in keyof TPayloads & string]: undefined extends TPayloads[TActionId]
    ? (payload?: TPayloads[TActionId]) => Promise<ActionResult>
    : (payload: TPayloads[TActionId]) => Promise<ActionResult>;
}>;

export interface TeleforgeNavigateOptions {
  data?: Record<string, unknown>;
}

export type NavigationHelpers<TScreenId extends string = string> = Readonly<
  Record<TScreenId, (params?: Record<string, string>, options?: TeleforgeNavigateOptions) => void>
>;

/**
 * Strongly-typed navigation helper map keyed by helper name.
 *
 * - Keys are camelCase helper names derived from screen IDs via `toHelperName()`.
 * - For each helper, `TRoutes[Helper]` describes the required route params.
 *   `undefined` means the route is static (no params required).
 *
 * Example:
 *
 * ```ts
 * type RouteParams = {
 *   catalog: undefined;
 *   productDetail: { id: string };
 * };
 *
 * const nav: TypedNavigationHelpers<RouteParams> = ...;
 * nav.catalog();
 * nav.productDetail({ id: "iphone-15" });
 * ```
 */
export type TypedNavigationHelpers<
  TRoutes extends Record<string, Record<string, string> | undefined>
> = Readonly<{
  [THelper in keyof TRoutes & string]: TRoutes[THelper] extends undefined
    ? (params?: undefined, options?: TeleforgeNavigateOptions) => void
    : (params: TRoutes[THelper], options?: TeleforgeNavigateOptions) => void;
}>;

/**
 * Options accepted by typed sign helpers. `screenId` and `route` are filled
 * in automatically by the helper; callers provide the remaining fields.
 */
export interface TypedSignOptions {
  flowId?: string;
  subject?: Record<string, unknown>;
  allowedActions?: string[];
  ttlSeconds?: number;
}

/**
 * Strongly-typed sign helper map keyed by helper name.
 *
 * Reuses the same route-param contracts as `TypedNavigationHelpers` so
 * signing a screen requires the same params as navigating to it.
 *
 * - Static routes take no `params`.
 * - Dynamic routes require `params` matching the route pattern.
 *
 * Example:
 *
 * ```ts
 * type RouteParams = {
 *   catalog: undefined;
 *   productDetail: { id: string };
 * };
 *
 * const typedSign: TypedSignHelpers<RouteParams> = ...;
 * const catalogUrl = await typedSign.catalog();
 * const detailUrl = await typedSign.productDetail({
 *   params: { id: "iphone-15" },
 *   subject: { resource: { type: "product", id: "iphone-15" } },
 *   allowedActions: ["addToCart"]
 * });
 * ```
 */
export type TypedSignHelpers<
  TRoutes extends Record<string, Record<string, string> | undefined>
> = Readonly<{
  [THelper in keyof TRoutes & string]: TRoutes[THelper] extends undefined
    ? (options?: TypedSignOptions) => Promise<string>
    : (options: TypedSignOptions & { params: TRoutes[THelper] }) => Promise<string>;
}>;

/**
 * Broad runtime-compatible bound for typed sign helpers. Generated per-flow
 * types such as `GadgetshopSign` are runtime-compatible with this shape.
 */
export type AnyTypedSignHelpers = Readonly<
  Record<string, (options?: Record<string, unknown>) => Promise<string>>
>;

export interface TeleforgeScreenComponentProps {
  scopeData?: Record<string, unknown>;
  routeParams: Record<string, string>;
  routeData?: Record<string, unknown>;
  loader: LoaderState;
  loaderData?: unknown;
  appState?: MiniAppState;
  actions: ActionHelpers;
  nav: NavigationHelpers;
  runAction: (actionId: string, payload?: unknown) => Promise<ActionResult>;
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

export interface TeleforgeScreenDefinition {
  component: ComponentType<TeleforgeScreenComponentProps>;
  guard?: (
    context: TeleforgeScreenComponentProps
  ) => MaybePromise<TeleforgeScreenGuardResult>;
  id: string;
  title?: string;
}

export interface DiscoveredScreenModule {
  filePath: string;
  screen: TeleforgeScreenDefinition;
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
}

export interface UnresolvedMiniAppScreen {
  flow?: AnyFlowDefinition;
  flowId?: string;
  pathname: string;
  reason: "missing_route" | "missing_screen";
  screenId?: string;
}

/**
 * Looser, runtime-compatible bound for screen component prop types.
 *
 * Generated per-screen prop aliases narrow `screenId`, `routeParams`,
 * `nav`, and (in later phases) `actions` — for example
 * `screenId: "catalog"`, `nav: GadgetshopNav`,
 * `routeParams: Readonly<Record<never, never>>`,
 * `actions: GadgetshopActions`. Those narrowed types cannot satisfy
 * `TProps extends TeleforgeScreenComponentProps` because
 * `NavigationHelpers`' / `ActionHelpers`' string index signature is
 * incompatible with the typed maps.
 *
 * Use this shape as the constraint instead so:
 * - generated aliases that override the four narrowable fields are
 *   still accepted, and
 * - components that ask for fields the runtime never provides (e.g.
 *   `{ foo: string }`) are still rejected at compile time.
 */
export type RuntimeCompatibleScreenProps = Omit<
  TeleforgeScreenComponentProps,
  "screenId" | "routeParams" | "nav" | "actions"
> & {
  screenId: string;
  routeParams: object;
  nav: object;
  actions: object;
};

export interface TeleforgeScreenDefinitionInput<
  TProps extends RuntimeCompatibleScreenProps = TeleforgeScreenComponentProps
> {
  component: ComponentType<TProps>;
  guard?: (
    context: TeleforgeScreenComponentProps
  ) => MaybePromise<TeleforgeScreenGuardResult>;
  id: string;
  title?: string;
}

export function defineScreen<
  TProps extends RuntimeCompatibleScreenProps = TeleforgeScreenComponentProps
>(
  screen: TeleforgeScreenDefinitionInput<TProps>
): Readonly<TeleforgeScreenDefinition> {
  if (typeof screen.id !== "string" || screen.id.trim().length === 0) {
    throw new Error("Screen id must be a non-empty string.");
  }

  if (typeof screen.component !== "function") {
    throw new Error(`Screen "${screen.id}" must define a component.`);
  }

  return Object.freeze({
    ...screen,
    component: screen.component as ComponentType<TeleforgeScreenComponentProps>
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

export interface ServerLoaderContext<TInput = unknown> {
  ctx: ActionContextToken;
  input: TInput;
  params: Record<string, string>;
  services: unknown;
  session?: SessionHandle;
}

export interface ServerLoaderDefinition<TInput = unknown, TResult = unknown> {
  input?: TeleforgeInputSchema<TInput>;
  handler: (ctx: ServerLoaderContext<TInput>) => MaybePromise<TResult>;
}

export function defineLoader<TInput, TResult>(
  loader: ServerLoaderDefinition<TInput, TResult>
): Readonly<ServerLoaderDefinition<TInput, TResult>> {
  if (typeof loader.handler !== "function") {
    throw new Error("Loader must define a handler function.");
  }

  return Object.freeze({ ...loader });
}

export interface LoaderRegistryEntry {
  handler: (ctx: ServerLoaderContext) => Promise<unknown>;
  input?: TeleforgeInputSchema;
}

export type LoaderRegistry = ReadonlyMap<string, LoaderRegistryEntry>;

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

export type RouteFlowLike = { id: string; miniApp?: { routes: Record<string, string> } };

export function findRoutePattern(
  screenId: string,
  flows: Iterable<RouteFlowLike>,
  pathname?: string
): string | null {
  const candidates: string[] = [];
  for (const flow of flows) {
    if (!flow.miniApp?.routes) continue;
    for (const [route, id] of Object.entries(flow.miniApp.routes)) {
      if (id === screenId) {
        if (pathname && routePatternMatches(route, pathname)) {
          return route;
        }
        candidates.push(route);
      }
    }
  }
  return candidates[0] ?? null;
}

export function extractRouteParams(
  pattern: string,
  pathname: string
): Record<string, string> {
  const params: Record<string, string> = {};
  const patternParts = pattern.split("/").filter(Boolean);
  const pathnameParts = pathname.split("/").filter(Boolean);

  if (patternParts.length !== pathnameParts.length) {
    return params;
  }

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      const key = patternParts[i].slice(1);
      params[key] = decodeURIComponent(pathnameParts[i]);
    } else if (patternParts[i] !== pathnameParts[i]) {
      return {};
    }
  }

  return params;
}

export function toHelperName(id: string): string {
  const name = id
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part, index) =>
      index === 0
        ? part.charAt(0).toLowerCase() + part.slice(1)
        : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join("");

  if (name.length === 0) {
    throw new Error(`Screen ID "${id}" normalizes to an empty helper name.`);
  }

  if (/^[0-9]/.test(name)) {
    throw new Error(
      `Screen ID "${id}" normalizes to "${name}" which starts with a digit. Helper names must start with a letter.`
    );
  }

  return name;
}

export function extractRequiredRouteParams(pattern: string): string[] {
  const parts = pattern.split("/").filter(Boolean);
  return parts
    .filter((p) => p.startsWith(":"))
    .map((p) => p.slice(1));
}

export function validateRouteParams(pattern: string, params?: Record<string, string>): void {
  const required = extractRequiredRouteParams(pattern);
  if (required.length === 0) return;

  const missing = required.filter((name) => !params || !(name in params));
  if (missing.length > 0) {
    throw new Error(
      `Navigation requires params [${missing.join(", ")}] for route "${pattern}".`
    );
  }
}
