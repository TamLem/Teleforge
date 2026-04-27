import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type {
  ActionFlowActionDefinition,
  ActionFlowDefinition,
  ActionFlowDefinitionInput,
  ActionFlowMiniAppDefinition
} from "./flow-definition.js";
import type { DiscoveredScreenModule } from "./screens.js";
import type { BotCommandDefinition, CommandContext } from "@teleforgex/bot";
import type {
  LaunchEntryPoint,
  RouteDefinition
} from "@teleforgex/core";

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
const HANDLER_FILE_SUFFIXES = [".ts", ".mts", ".js", ".mjs"] as const;
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
  miniAppUrl: string | ((context: CommandContext, flow: AnyFlowDefinition) => Promise<string> | string);
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
  options: DiscoverFlowHandlerFilesOptions
): Promise<string[]> {
  return [];
}

export async function loadTeleforgeFlowHandlers(
  _options: LoadTeleforgeFlowHandlersOptions
): Promise<DiscoveredFlowStepHandlerModule[]> {
  return [];
}

export async function discoverFlowServerHookFiles(
  options: DiscoverFlowServerHookFilesOptions
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
        const sign = async (params: {
          flowId: string;
          screenId: string;
          subject?: Record<string, unknown>;
          allowedActions?: string[];
        }) => {
          const { createSignedActionContext } = await import("@teleforgex/core");
          const now = Math.floor(Date.now() / 1000);
          const ttl = 900;
          const token = createSignedActionContext(
            {
              allowedActions: params.allowedActions,
              appId: options.appId,
              expiresAt: now + ttl,
              flowId: params.flowId,
              issuedAt: now,
              screenId: params.screenId,
              subject: params.subject,
              userId: String(context.user.id)
            },
            options.secret
          );
          const url = new URL(miniAppUrl);
          url.searchParams.set("tgWebAppStartParam", token);
          return url.toString();
        };

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

export function createFlowRoutes(options: CreateFlowRoutesOptions): Array<{ path: string; flowId: string; screenId: string }> {
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
  return Array.from(normalizeDiscoveredFlows(flows), (flow) => createFlowRuntimeSummary(flow, options));
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
        throw new Error(
          `Duplicate Mini App route "${route}" discovered across flows.`
        );
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

function resolveFlowHandlersRoot(options: DiscoverFlowHandlerFilesOptions): string {
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

function stripKnownExtension(
  filename: string,
  suffixes: readonly string[]
): string {
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
