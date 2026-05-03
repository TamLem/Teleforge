import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { extractRequiredRouteParams, toHelperName } from "./screens.js";

import type {
  ActionFlowActionDefinition,
  ActionFlowDefinition,
  ActionFlowMiniAppDefinition
} from "./flow-definition.js";
import type {
  DiscoveredScreenModule,
  LoaderRegistry,
  LoaderRegistryEntry,
  ServerLoaderContext,
  ServerLoaderDefinition
} from "./screens.js";
import type { BotCommandDefinition, CommandContext } from "@teleforge/bot";
import type { RouteDefinition, SignContextFn } from "@teleforge/core";

type AnyFlowDefinition = ActionFlowDefinition;
type DiscoveredHandlerFunction = (...args: unknown[]) => unknown;

const FLOW_FILE_SUFFIXES = [".flow.ts", ".flow.mts", ".flow.js", ".flow.mjs"] as const;
const SCREEN_FILE_SUFFIXES = [
  ".screen.tsx",
  ".screen.ts",
  ".screen.mts",
  ".screen.jsx",
  ".screen.js",
  ".screen.mjs"
] as const;
const _HANDLER_FILE_SUFFIXES = [".ts", ".mts", ".js", ".mjs"] as const;
const DEFAULT_FLOW_ROOT = "flows";

export interface TeleforgeFlowConventions {
  handlersRoot?: string;
  root?: string;
  serverHooksRoot?: string;
}

export interface DiscoverFlowFilesOptions {
  app?: {
    flows?: TeleforgeFlowConventions;
  };
  cwd: string;
  root?: string;
}

export interface LoadTeleforgeFlowsOptions extends DiscoverFlowFilesOptions {}

export interface DiscoverFlowHandlerFilesOptions {
  app?: {
    flows?: TeleforgeFlowConventions;
  };
  cwd: string;
  root?: string;
}

export interface LoadTeleforgeFlowHandlersOptions extends DiscoverFlowHandlerFilesOptions {}

export interface DiscoverFlowServerHookFilesOptions {
  app?: {
    flows?: TeleforgeFlowConventions;
  };
  cwd: string;
  root?: string;
}

export interface LoadTeleforgeFlowServerHooksOptions extends DiscoverFlowServerHookFilesOptions {}

export interface DiscoverScreenFilesOptions {
  app?: {
    miniApp: {
      entry: string;
      screensRoot?: string;
    };
  };
  cwd: string;
  root?: string;
}

export interface LoadTeleforgeScreensOptions extends DiscoverScreenFilesOptions {}

export interface DiscoverScreenLoaderFilesOptions {
  app?: {
    flows?: TeleforgeFlowConventions;
  };
  cwd: string;
  root?: string;
}

export interface LoadScreenLoadersOptions extends DiscoverScreenLoaderFilesOptions {}

export interface DiscoveredFlowModule {
  filePath: string;
  flow: AnyFlowDefinition;
}

export interface DiscoveredFlowActionSummary {
  id: string;
  hasHandler: boolean;
  requiresSession: boolean;
}

export interface DiscoveredFlowRuntimeSummary {
  id: string;
  command?: string;
  filePath?: string;
  routeCount: number;
  routes: readonly string[];
  actionCount: number;
  actions: readonly DiscoveredFlowActionSummary[];
  hasSession: boolean;
}

export interface DiscoveredFlowStepHandlerModule {
  actions: Readonly<Record<string, DiscoveredHandlerFunction>>;
  filePath: string;
  flowId: string;
  stepId: string;
}

export interface DiscoveredFlowStepServerHookModule {
  actions: Readonly<Record<string, DiscoveredHandlerFunction>>;
  filePath: string;
  flowId: string;
  guard?: DiscoveredHandlerFunction;
  loader?: DiscoveredHandlerFunction;
  stepId: string;
}

export interface CreateFlowRuntimeSummaryOptions {
  handlers?: Iterable<DiscoveredFlowStepHandlerModule>;
  serverHooks?: Iterable<DiscoveredFlowStepServerHookModule>;
}

export interface CreateFlowCommandsOptions {
  appId: string;
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>;
  miniAppUrl:
    | string
    | ((context: CommandContext, flow: AnyFlowDefinition) => Promise<string> | string);
  secret: string;
  services?: unknown;
  sessionManager?: unknown;
}

export interface CreateFlowRoutesOptions {
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>;
  routes?: readonly RouteDefinition[];
}

export async function discoverScreenFiles(options: DiscoverScreenFilesOptions): Promise<string[]> {
  const root = resolveScreenRoot(options);
  const absoluteRoot = path.resolve(options.cwd, root);

  try {
    return await collectFilesBySuffix(absoluteRoot, SCREEN_FILE_SUFFIXES);
  } catch (error) {
    if (isMissingPathError(error)) {
      return [];
    }

    throw error;
  }
}

export function resolveScreenRoot(options: DiscoverScreenFilesOptions): string {
  if (options.root) {
    return options.root;
  }

  if (options.app?.miniApp.screensRoot) {
    return options.app.miniApp.screensRoot;
  }

  return path.join(path.dirname(options.app?.miniApp.entry ?? "apps/web/src/main.tsx"), "screens");
}

export async function loadTeleforgeScreens(
  options: LoadTeleforgeScreensOptions
): Promise<DiscoveredScreenModule[]> {
  const files = await discoverScreenFiles(options);
  const discovered: DiscoveredScreenModule[] = [];
  const seenIds = new Map<string, string>();

  for (const filePath of files) {
    const screen = await loadScreenDefinition(filePath);
    const existing = seenIds.get(screen.id);

    if (existing) {
      throw new Error(
        `Duplicate screen id "${screen.id}" discovered in "${existing}" and "${filePath}".`
      );
    }

    seenIds.set(screen.id, filePath);
    discovered.push({
      filePath,
      screen
    });
  }

  return discovered;
}

export async function discoverFlowFiles(options: DiscoverFlowFilesOptions): Promise<string[]> {
  const root = resolveFlowRoot(options);
  const absoluteRoot = path.resolve(options.cwd, root);

  try {
    return await collectFlowFiles(absoluteRoot);
  } catch (error) {
    if (isMissingPathError(error)) {
      return [];
    }

    throw error;
  }
}

export async function loadTeleforgeFlows(
  options: LoadTeleforgeFlowsOptions
): Promise<DiscoveredFlowModule[]> {
  const files = await discoverFlowFiles(options);
  const discovered: DiscoveredFlowModule[] = [];
  const seenIds = new Map<string, string>();

  for (const filePath of files) {
    const flow = await loadFlowDefinition(filePath);
    const existing = seenIds.get(flow.id);

    if (existing) {
      throw new Error(
        `Duplicate flow id "${flow.id}" discovered in "${existing}" and "${filePath}".`
      );
    }

    seenIds.set(flow.id, filePath);
    discovered.push({
      filePath,
      flow
    });
  }

  return discovered;
}

export async function discoverFlowHandlerFiles(
  _options: DiscoverFlowHandlerFilesOptions
): Promise<string[]> {
  return [];
}

export async function loadTeleforgeFlowHandlers(
  _options: LoadTeleforgeFlowHandlersOptions
): Promise<DiscoveredFlowStepHandlerModule[]> {
  return [];
}

export async function discoverFlowServerHookFiles(
  _options: DiscoverFlowServerHookFilesOptions
): Promise<string[]> {
  return [];
}

export async function loadTeleforgeFlowServerHooks(
  _options: LoadTeleforgeFlowServerHooksOptions
): Promise<DiscoveredFlowStepServerHookModule[]> {
  return [];
}

export function createFlowCommands(options: CreateFlowCommandsOptions): BotCommandDefinition[] {
  const commands: BotCommandDefinition[] = [];
  const seenCommands = new Map<string, string>();

  for (const flow of normalizeDiscoveredFlows(options.flows)) {
    if (!flow.command) {
      continue;
    }

    const commandName = normalizeCommandName(flow.command.command);
    const existing = seenCommands.get(commandName);

    if (existing) {
      throw new Error(
        `Duplicate command "/${commandName}" discovered in flows "${existing}" and "${flow.id}".`
      );
    }

    seenCommands.set(commandName, flow.id);

    commands.push({
      command: commandName,
      description: flow.command.description,
      handler: async (context) => {
        const miniAppUrl = await resolveCommandValue(options.miniAppUrl, context);
        const sign = createSignForActionContext({
          appId: options.appId,
          defaultFlowId: flow.id,
          flowSecret: options.secret,
          miniAppUrl,
          userId: String(context.user.id)
        });

        await flow.command!.handler({
          ctx: context,
          services: options.services as never,
          session: undefined,
          sign
        });
      }
    });
  }

  return commands;
}

export function createFlowRoutes(
  options: CreateFlowRoutesOptions
): Array<{ path: string; flowId: string; screenId: string }> {
  const result: Array<{ path: string; flowId: string; screenId: string }> = [];

  for (const flow of normalizeDiscoveredFlows(options.flows)) {
    if (!flow.miniApp?.routes) {
      continue;
    }

    for (const [routePath, screenId] of Object.entries(flow.miniApp.routes)) {
      result.push({
        flowId: flow.id,
        path: routePath,
        screenId
      });
    }
  }

  return result;
}

export function createFlowCoordinationConfigFromFlows(
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>
): Array<{ flowId: string; miniApp?: ActionFlowMiniAppDefinition }> {
  return Array.from(normalizeDiscoveredFlows(flows), (flow) => ({
    flowId: flow.id,
    miniApp: flow.miniApp
  }));
}

export function createFlowRuntimeSummary(
  flow: AnyFlowDefinition,
  _options?: CreateFlowRuntimeSummaryOptions
): DiscoveredFlowRuntimeSummary {
  return {
    actionCount: Object.keys(flow.actions ?? {}).length,
    actions: Object.entries(flow.actions ?? {}).map(([id, action]) => ({
      hasHandler: true,
      id,
      requiresSession: action.requiresSession ?? false
    })),
    command: flow.command?.command,
    hasSession: flow.session?.enabled ?? false,
    id: flow.id,
    routeCount: Object.keys(flow.miniApp?.routes ?? {}).length,
    routes: Object.keys(flow.miniApp?.routes ?? {})
  };
}

export function createFlowRuntimeSummaries(
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>,
  options?: CreateFlowRuntimeSummaryOptions
): DiscoveredFlowRuntimeSummary[] {
  return Array.from(normalizeDiscoveredFlows(flows), (flow) =>
    createFlowRuntimeSummary(flow, options)
  );
}

export interface DiscoveredFlowRuntimeDebugState {
  sessions: readonly DiscoveredFlowRuntimeSessionDebugState[];
  updatedAt: string | null;
}

export interface DiscoveredFlowRuntimeSessionDebugState {
  flowId: string;
  userId: string;
  actionCount: number;
  hasSession: boolean;
}

export interface DiscoveredFlowRuntimeMiniAppDebugState {
  lastActionAt: string | null;
}

export function loadActionRegistry(
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>
): ReadonlyMap<string, ActionFlowActionDefinition> {
  const registry = new Map<string, ActionFlowActionDefinition>();

  for (const entry of flows) {
    const flow = "flow" in entry ? entry.flow : entry;

    for (const [actionId, action] of Object.entries(flow.actions ?? {})) {
      const key = `${flow.id}:${actionId}`;
      if (registry.has(key)) {
        throw new Error(`Duplicate action "${key}" discovered across flows.`);
      }
      registry.set(key, action);
    }
  }

  return registry;
}

export function loadRouteRegistry(
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
        throw new Error(`Duplicate Mini App route "${route}" discovered across flows.`);
      }

      routes.set(route, { flowId: flow.id, screenId });
    }
  }

  return routes;
}

export function resolveFlowServerHooksRoot(options: DiscoverFlowServerHookFilesOptions): string {
  if (options.root) {
    return options.root;
  }

  const serverHooksRoot = options.app?.flows?.serverHooksRoot;
  if (serverHooksRoot) {
    return serverHooksRoot;
  }

  const flowRoot = resolveFlowRoot(options);
  return path.join(flowRoot, "..", "flow-hooks");
}

// Internal helpers

function resolveFlowRoot(options: DiscoverFlowFilesOptions): string {
  if (options.root) {
    return options.root;
  }

  if (options.app?.flows?.root) {
    return options.app.flows.root;
  }

  return DEFAULT_FLOW_ROOT;
}

function _resolveFlowHandlersRoot(options: DiscoverFlowHandlerFilesOptions): string {
  if (options.root) {
    return options.root;
  }

  const handlersRoot = options.app?.flows?.handlersRoot;
  if (handlersRoot) {
    return handlersRoot;
  }

  const flowRoot = resolveFlowRoot(options);
  return path.join(flowRoot, "..", "flow-handlers");
}

async function loadFlowDefinition(filePath: string): Promise<ActionFlowDefinition> {
  const module = await import(pathToFileURL(filePath).href);
  const flow = module.default ?? module.flow;

  if (!flow || typeof flow.id !== "string") {
    throw new Error(
      `Flow module "${filePath}" must export a flow definition via export default defineFlow(...).`
    );
  }

  return flow as ActionFlowDefinition;
}

async function loadScreenDefinition(filePath: string) {
  const module = await import(pathToFileURL(filePath).href);
  const screen = module.default ?? module.screen;

  if (!screen || typeof screen.id !== "string") {
    throw new Error(
      `Screen module "${filePath}" must export a screen definition via export default defineScreen(...).`
    );
  }

  return screen;
}

async function collectFilesBySuffix(
  absoluteRoot: string,
  suffixes: readonly string[]
): Promise<string[]> {
  const entries = await readdir(absoluteRoot, {
    recursive: true,
    withFileTypes: true
  });

  return entries
    .filter((entry) => entry.isFile() && suffixes.some((suffix) => entry.name.endsWith(suffix)))
    .map((entry) => path.join(entry.parentPath ?? absoluteRoot, entry.name))
    .sort();
}

async function collectFlowFiles(absoluteRoot: string): Promise<string[]> {
  return collectFilesBySuffix(absoluteRoot, FLOW_FILE_SUFFIXES);
}

function stripKnownExtension(filename: string, suffixes: readonly string[]): string {
  for (const suffix of suffixes) {
    if (filename.endsWith(suffix)) {
      return filename.slice(0, -suffix.length);
    }
  }

  return filename;
}

function normalizeDiscoveredFlows(
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>
): AnyFlowDefinition[] {
  return Array.from(flows, (entry) => ("flow" in entry ? entry.flow : entry));
}

function normalizeCommandName(command: string): string {
  return command.replace(/^\//, "").trim().toLowerCase();
}

function isMissingPathError(error: unknown): boolean {
  if (error instanceof Error) {
    const nodeError = error as NodeJS.ErrnoException;
    return nodeError.code === "ENOENT";
  }
  return false;
}

async function resolveCommandValue<T>(
  value: T | ((context: CommandContext, flow: AnyFlowDefinition) => Promise<T> | T),
  context: CommandContext,
  flow?: AnyFlowDefinition
): Promise<T> {
  if (typeof value === "function") {
    return (value as (context: CommandContext, flow: AnyFlowDefinition) => Promise<T> | T)(
      context,
      flow!
    );
  }

  return value;
}

export function substituteRouteParams(pattern: string, params: Record<string, string>): string {
  return pattern
    .split("/")
    .map((part) => {
      if (!part.startsWith(":")) return part;
      const name = part.slice(1);
      const value = params[name];
      if (value === undefined) {
        throw new Error(`Missing required route param "${name}" for pattern "${pattern}".`);
      }
      return encodeURIComponent(value);
    })
    .join("/");
}

export function createTypedSignForActionContext(options: {
  sign: SignContextFn;
  routes: Record<string, string>;
}): Record<string, (options?: Record<string, unknown>) => Promise<string>> {
  const screenToPattern = new Map<string, string>();
  for (const [pattern, screenId] of Object.entries(options.routes)) {
    if (!screenToPattern.has(screenId)) {
      screenToPattern.set(screenId, pattern);
    }
  }

  const helpers: Record<string, (options?: Record<string, unknown>) => Promise<string>> = {};
  const seenHelpers = new Map<string, string>(); // helperName -> screenId

  for (const [screenId, pattern] of screenToPattern.entries()) {
    const helperName = toHelperName(screenId);
    const existingScreenId = seenHelpers.get(helperName);
    if (existingScreenId && existingScreenId !== screenId) {
      throw new Error(
        `Sign helper name "${helperName}" collides between screen IDs "${existingScreenId}" and "${screenId}".`
      );
    }
    seenHelpers.set(helperName, screenId);
    const requiredParams = extractRequiredRouteParams(pattern);

    helpers[helperName] = async (opts = {}) => {
      const params = (opts as Record<string, unknown>).params as Record<string, string> | undefined;

      if (requiredParams.length > 0) {
        const missing = requiredParams.filter((name) => !params || !(name in params));
        if (missing.length > 0) {
          throw new Error(
            `Sign helper "${helperName}" requires params [${missing.join(", ")}] for route "${pattern}".`
          );
        }
      }

      const route =
        requiredParams.length > 0 && params ? substituteRouteParams(pattern, params) : pattern;

      const url = await options.sign({
        screenId,
        flowId: opts.flowId as string | undefined,
        subject: opts.subject as Record<string, unknown> | undefined,
        allowedActions: opts.allowedActions as string[] | undefined,
        ttlSeconds: opts.ttlSeconds as number | undefined
      });

      const resolved = new URL(url);
      resolved.pathname = route;
      return resolved.toString();
    };
  }

  return helpers;
}

export function createSignForActionContext(options: {
  appId: string;
  defaultFlowId: string;
  flowSecret: string;
  miniAppUrl: string;
  userId: string;
}): SignContextFn {
  return async (params) => {
    const { createSignedActionContext } = await import("@teleforge/core");
    const now = Math.floor(Date.now() / 1000);
    const ttl = params.ttlSeconds ?? 900;
    const token = createSignedActionContext(
      {
        allowedActions: params.allowedActions,
        appId: options.appId,
        expiresAt: now + ttl,
        flowId: params.flowId ?? options.defaultFlowId,
        issuedAt: now,
        screenId: params.screenId,
        subject: params.subject,
        userId: options.userId
      },
      options.flowSecret
    );
    const url = new URL(options.miniAppUrl);
    url.searchParams.set("tgWebAppStartParam", token);
    return url.toString();
  };
}

const LOADER_FILE_SUFFIXES = [".loader.ts", ".loader.mts", ".loader.js", ".loader.mjs"] as const;

export async function discoverScreenLoaderFiles(
  options: DiscoverScreenLoaderFilesOptions
): Promise<string[]> {
  const root = resolveScreenLoaderRoot(options);
  const absoluteRoot = path.resolve(options.cwd, root);

  try {
    return await collectFilesBySuffix(absoluteRoot, LOADER_FILE_SUFFIXES);
  } catch (error) {
    if (isMissingPathError(error)) {
      return [];
    }

    throw error;
  }
}

export async function loadScreenLoaders(
  options: LoadScreenLoadersOptions
): Promise<LoaderRegistry> {
  const files = await discoverScreenLoaderFiles(options);
  const registry = new Map<string, LoaderRegistryEntry>();

  for (const filePath of files) {
    const screenId = stripKnownExtension(path.basename(filePath), LOADER_FILE_SUFFIXES);
    if (registry.has(screenId)) {
      throw new Error(`Duplicate screen loader "${screenId}" in "${filePath}".`);
    }

    const module = await import(pathToFileURL(filePath).href);
    const exported = module.default ?? module.loader;

    if (isLoaderDefinition(exported)) {
      registry.set(screenId, {
        handler: async (ctx: ServerLoaderContext) =>
          exported.handler(ctx as ServerLoaderContext<unknown>),
        input: exported.input
      });
    } else if (typeof exported === "function") {
      registry.set(screenId, {
        handler: async (ctx) => await exported(ctx)
      });
    } else {
      throw new Error(
        `Screen loader module "${filePath}" must export a loader function (default or named "loader") or a defineLoader({ input, handler }) result.`
      );
    }
  }

  return registry;
}

function isLoaderDefinition(value: unknown): value is ServerLoaderDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    "handler" in value &&
    typeof (value as ServerLoaderDefinition).handler === "function"
  );
}

export function resolveScreenLoaderRoot(options: DiscoverScreenLoaderFilesOptions): string {
  if (options.root) {
    return options.root;
  }

  const configured = options.app?.flows?.serverHooksRoot;
  if (configured) {
    return configured;
  }

  return path.join("apps", "api", "src", "loaders");
}
