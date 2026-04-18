import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { defineCoordinationConfig } from "@teleforgex/core";

import { createFlowStartCommand, resolveFlowActionKey } from "./flow.js";

import type {
  CreateFlowStartCommandOptions,
  FlowStepDefinition,
  TeleforgeFlowDefinition
} from "./flow.js";
import type { DiscoveredScreenModule } from "./screens.js";
import type { BotCommandDefinition, CommandContext } from "@teleforgex/bot";
import type {
  CoordinationDefaults,
  RouteDefinition,
  RouteCoordinationConfig,
  ResolvedCoordinationConfig,
  ReturnToChatMetadata,
  UserFlowStateManager
} from "@teleforgex/core";

type AnyFlowDefinition = TeleforgeFlowDefinition<
  unknown,
  unknown,
  Record<string, FlowStepDefinition<unknown, unknown>>
>;

const FLOW_FILE_SUFFIXES = [".flow.ts", ".flow.mts", ".flow.js", ".flow.mjs"] as const;
const SCREEN_FILE_SUFFIXES = [".screen.tsx", ".screen.ts", ".screen.mts", ".screen.jsx", ".screen.js", ".screen.mjs"] as const;
const HANDLER_FILE_SUFFIXES = [".ts", ".mts", ".js", ".mjs"] as const;
const DEFAULT_FLOW_ROOT = "flows";
type DiscoveredHandlerFunction = (...args: unknown[]) => unknown;

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

export interface DiscoveredFlowActionSummary {
  hasHandler: boolean;
  handlerSource: "inline" | "module" | "none" | "server";
  id: string;
  label: string;
  to?: string;
}

export interface DiscoveredFlowStepSummary {
  actionCount: number;
  actions: readonly DiscoveredFlowActionSummary[];
  discoveredActionHandlerIds: readonly string[];
  discoveredServerActionIds: readonly string[];
  handlerFile?: string;
  hasDiscoveredModule: boolean;
  hasOnEnter: boolean;
  hasOnSubmit: boolean;
  id: string;
  resolvedOnEnter: boolean;
  resolvedOnSubmit: boolean;
  resolvedServerGuard: boolean;
  resolvedServerLoader: boolean;
  resolvedServerSubmit: boolean;
  screen?: string;
  serverHookFile?: string;
  hasServerHookModule: boolean;
  type: "chat" | "miniapp";
}

export interface DiscoveredFlowRuntimeSummary {
  command?: string;
  filePath?: string;
  finalStep: string;
  hasRuntimeHandlers: boolean;
  id: string;
  initialStep: string;
  route?: string;
  stepCount: number;
  steps: readonly DiscoveredFlowStepSummary[];
}

export interface DiscoveredFlowStepHandlerModule {
  actions: Readonly<Record<string, DiscoveredHandlerFunction>>;
  filePath: string;
  flowId: string;
  onEnter?: DiscoveredHandlerFunction;
  onSubmit?: DiscoveredHandlerFunction;
  stepId: string;
}

export interface DiscoveredFlowStepServerHookModule {
  actions: Readonly<Record<string, DiscoveredHandlerFunction>>;
  filePath: string;
  flowId: string;
  guard?: DiscoveredHandlerFunction;
  loader?: DiscoveredHandlerFunction;
  onSubmit?: DiscoveredHandlerFunction;
  stepId: string;
}

export interface CreateFlowRuntimeSummaryOptions {
  handlers?: Iterable<DiscoveredFlowStepHandlerModule>;
  serverHooks?: Iterable<DiscoveredFlowStepServerHookModule>;
}

export interface CreateFlowCommandsOptions {
  buttonText?:
    | string
    | ((
        context: CommandContext,
        flow: AnyFlowDefinition
      ) => Promise<string | undefined> | string | undefined);
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>;
  messageOptions?: CreateFlowStartCommandOptions<unknown>["messageOptions"];
  requestWriteAccess?: boolean;
  returnText?:
    | string
    | ((
        context: CommandContext,
        flow: AnyFlowDefinition
      ) => Promise<string | undefined> | string | undefined);
  secret: string;
  stayInChat?: boolean;
  storage: UserFlowStateManager;
  text?: string | ((context: CommandContext, flow: AnyFlowDefinition) => Promise<string> | string);
  webAppUrl:
    | string
    | ((context: CommandContext, flow: AnyFlowDefinition) => Promise<string> | string);
}

export interface CreateFlowCoordinationConfigFromFlowsOptions {
  defaults?: Partial<CoordinationDefaults>;
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>;
  returnToChat?: ReturnToChatMetadata;
}

export interface CreateFlowRoutesOptions {
  defaults?: Partial<CoordinationDefaults>;
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>;
  routes?: readonly RouteDefinition[];
  returnToChat?: ReturnToChatMetadata;
}

const DEFAULT_COORDINATION_DEFAULTS = Object.freeze({
  expiryMinutes: 15,
  persistence: "session"
}) as CoordinationDefaults;

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
  const root = resolveFlowHandlersRoot(options);
  const absoluteRoot = path.resolve(options.cwd, root);

  try {
    return await collectFilesBySuffix(absoluteRoot, HANDLER_FILE_SUFFIXES);
  } catch (error) {
    if (isMissingPathError(error)) {
      return [];
    }

    throw error;
  }
}

export async function loadTeleforgeFlowHandlers(
  options: LoadTeleforgeFlowHandlersOptions
): Promise<DiscoveredFlowStepHandlerModule[]> {
  const files = await discoverFlowHandlerFiles(options);
  const root = path.resolve(options.cwd, resolveFlowHandlersRoot(options));
  const discovered: DiscoveredFlowStepHandlerModule[] = [];
  const seenKeys = new Map<string, string>();

  for (const filePath of files) {
    const relativePath = path.relative(root, filePath);
    const segments = relativePath.split(path.sep);

    if (segments.length !== 2) {
      throw new Error(
        `Flow handler module "${filePath}" must live at <handlersRoot>/<flowId>/<stepId>.<ext>.`
      );
    }

    const flowId = segments[0];
    const stepId = stripKnownExtension(segments[1], HANDLER_FILE_SUFFIXES);
    const key = `${flowId}:${stepId}`;
    const existing = seenKeys.get(key);

    if (existing) {
      throw new Error(
        `Duplicate flow step handler "${key}" discovered in "${existing}" and "${filePath}".`
      );
    }

    seenKeys.set(key, filePath);
    discovered.push(await loadFlowHandlerModule(filePath, flowId, stepId));
  }

  return discovered;
}

export async function discoverFlowServerHookFiles(
  options: DiscoverFlowServerHookFilesOptions
): Promise<string[]> {
  const root = resolveFlowServerHooksRoot(options);
  const absoluteRoot = path.resolve(options.cwd, root);

  try {
    return await collectFilesBySuffix(absoluteRoot, HANDLER_FILE_SUFFIXES);
  } catch (error) {
    if (isMissingPathError(error)) {
      return [];
    }

    throw error;
  }
}

export async function loadTeleforgeFlowServerHooks(
  options: LoadTeleforgeFlowServerHooksOptions
): Promise<DiscoveredFlowStepServerHookModule[]> {
  const files = await discoverFlowServerHookFiles(options);
  const root = path.resolve(options.cwd, resolveFlowServerHooksRoot(options));
  const discovered: DiscoveredFlowStepServerHookModule[] = [];
  const seenKeys = new Map<string, string>();

  for (const filePath of files) {
    const relativePath = path.relative(root, filePath);
    const segments = relativePath.split(path.sep);

    if (segments.length !== 2) {
      throw new Error(
        `Flow server-hook module "${filePath}" must live at <serverHooksRoot>/<flowId>/<stepId>.<ext>.`
      );
    }

    const flowId = segments[0];
    const stepId = stripKnownExtension(segments[1], HANDLER_FILE_SUFFIXES);
    const key = `${flowId}:${stepId}`;
    const existing = seenKeys.get(key);

    if (existing) {
      throw new Error(
        `Duplicate flow step server hook "${key}" discovered in "${existing}" and "${filePath}".`
      );
    }

    seenKeys.set(key, filePath);
    discovered.push(await loadFlowServerHookModule(filePath, flowId, stepId));
  }

  return discovered;
}

export function createFlowCommands(options: CreateFlowCommandsOptions): BotCommandDefinition[] {
  const commands: BotCommandDefinition[] = [];

  for (const flow of normalizeDiscoveredFlows(options.flows)) {
    const command = flow.bot?.command;

    if (!command) {
      continue;
    }

    const buttonText = options.buttonText ?? command.buttonText;
    const returnText = options.returnText ?? flow.miniApp?.returnToChat?.text;
    const text = options.text ?? command.text;
    const webAppUrl = options.webAppUrl;

    commands.push(
      createFlowStartCommand({
        buttonText:
          typeof buttonText === "function"
            ? (context) => resolveFlowScopedValue(buttonText, context, flow)
            : buttonText,
        command: command.command,
        description: command.description,
        entryStep: command.entryStep as keyof typeof flow.steps & string,
        flow,
        messageOptions: options.messageOptions,
        requestWriteAccess: options.requestWriteAccess ?? flow.miniApp?.requestWriteAccess,
        returnText:
          typeof returnText === "function"
            ? (context) => resolveFlowScopedValue(returnText, context, flow)
            : returnText,
        secret: options.secret,
        stayInChat: options.stayInChat,
        storage: options.storage,
        text:
          typeof text === "function"
            ? (context) => resolveFlowScopedRequiredValue<string>(text, context, flow)
            : text,
        webAppUrl:
          typeof webAppUrl === "function"
            ? (context) => resolveFlowScopedRequiredValue<string>(webAppUrl, context, flow)
            : webAppUrl
      })
    );
  }

  return commands;
}

export function createFlowRuntimeSummary(
  flowOrModule: AnyFlowDefinition | DiscoveredFlowModule,
  options: CreateFlowRuntimeSummaryOptions = {}
): DiscoveredFlowRuntimeSummary {
  const flow = "flow" in flowOrModule ? flowOrModule.flow : flowOrModule;
  const filePath = "filePath" in flowOrModule ? flowOrModule.filePath : undefined;
  const handlerIndex = createFlowHandlerIndex(options.handlers ?? []);
  const serverHookIndex = createFlowServerHookIndex(options.serverHooks ?? []);
  const steps = Object.entries(flow.steps).map(([stepId, step]) => {
    const discoveredHandler = handlerIndex.get(`${flow.id}:${stepId}`);
    const discoveredServerHook = serverHookIndex.get(`${flow.id}:${stepId}`);

    if (step.type === "chat") {
      const actions = (step.actions ?? []).map((action) =>
        Object.freeze({
          hasHandler:
            typeof action.handler === "function" ||
            typeof discoveredHandler?.actions[resolveFlowActionKey(action)] === "function" ||
            typeof discoveredServerHook?.actions[resolveFlowActionKey(action)] === "function",
          handlerSource:
            typeof action.handler === "function"
              ? ("inline" as const)
              : typeof discoveredHandler?.actions[resolveFlowActionKey(action)] === "function"
                ? ("module" as const)
                : typeof discoveredServerHook?.actions[resolveFlowActionKey(action)] === "function"
                  ? ("server" as const)
                : ("none" as const),
          id: resolveFlowActionKey(action),
          label: action.label,
          ...(action.to ? { to: action.to } : {})
        })
      );

      return Object.freeze({
        actionCount: actions.length,
        actions,
        discoveredActionHandlerIds: Object.freeze(Object.keys(discoveredHandler?.actions ?? {})),
        discoveredServerActionIds: Object.freeze(Object.keys(discoveredServerHook?.actions ?? {})),
        ...(discoveredHandler?.filePath ? { handlerFile: discoveredHandler.filePath } : {}),
        hasDiscoveredModule: Boolean(discoveredHandler),
        hasServerHookModule: Boolean(discoveredServerHook),
        hasOnEnter: typeof step.onEnter === "function",
        hasOnSubmit: false,
        id: stepId,
        resolvedOnEnter:
          typeof step.onEnter === "function" || typeof discoveredHandler?.onEnter === "function",
        resolvedOnSubmit: false,
        resolvedServerGuard: false,
        resolvedServerLoader: false,
        resolvedServerSubmit: false,
        ...(discoveredServerHook?.filePath ? { serverHookFile: discoveredServerHook.filePath } : {}),
        type: "chat" as const
      });
    }

    const actions = (step.actions ?? []).map((action) =>
      Object.freeze({
        hasHandler:
          typeof action.handler === "function" ||
          typeof discoveredHandler?.actions[resolveFlowActionKey(action)] === "function" ||
          typeof discoveredServerHook?.actions[resolveFlowActionKey(action)] === "function",
        handlerSource:
          typeof action.handler === "function"
            ? ("inline" as const)
            : typeof discoveredHandler?.actions[resolveFlowActionKey(action)] === "function"
              ? ("module" as const)
              : typeof discoveredServerHook?.actions[resolveFlowActionKey(action)] === "function"
                ? ("server" as const)
                : ("none" as const),
        id: resolveFlowActionKey(action),
        label: action.label,
        ...(action.to ? { to: action.to } : {})
      })
    );

    return Object.freeze({
      actionCount: actions.length,
      actions: Object.freeze(actions),
      discoveredActionHandlerIds: Object.freeze(Object.keys(discoveredHandler?.actions ?? {})),
      discoveredServerActionIds: Object.freeze(Object.keys(discoveredServerHook?.actions ?? {})),
      ...(discoveredHandler?.filePath ? { handlerFile: discoveredHandler.filePath } : {}),
      hasDiscoveredModule: Boolean(discoveredHandler),
      hasServerHookModule: Boolean(discoveredServerHook),
      hasOnEnter: typeof step.onEnter === "function",
      hasOnSubmit: typeof step.onSubmit === "function",
      id: stepId,
      resolvedOnEnter:
        typeof step.onEnter === "function" || typeof discoveredHandler?.onEnter === "function",
      resolvedOnSubmit:
        typeof step.onSubmit === "function" ||
        typeof discoveredHandler?.onSubmit === "function" ||
        typeof discoveredServerHook?.onSubmit === "function",
      resolvedServerGuard: typeof discoveredServerHook?.guard === "function",
      resolvedServerLoader: typeof discoveredServerHook?.loader === "function",
      resolvedServerSubmit: typeof discoveredServerHook?.onSubmit === "function",
      ...(step.screen ? { screen: step.screen } : {}),
      ...(discoveredServerHook?.filePath ? { serverHookFile: discoveredServerHook.filePath } : {}),
      type: "miniapp" as const
    });
  });

  const hasRuntimeHandlers = steps.some(
    (step) =>
      step.resolvedOnEnter ||
      step.resolvedOnSubmit ||
      step.resolvedServerGuard ||
      step.resolvedServerLoader ||
      step.resolvedServerSubmit ||
      step.actions.some((action) => action.hasHandler)
  );

  return Object.freeze({
    ...(flow.bot?.command?.command ? { command: flow.bot.command.command } : {}),
    ...(filePath ? { filePath } : {}),
    finalStep: String(flow.finalStep),
    hasRuntimeHandlers,
    id: flow.id,
    initialStep: String(flow.initialStep),
    ...(flow.miniApp?.route ? { route: flow.miniApp.route } : {}),
    stepCount: steps.length,
    steps: Object.freeze(steps)
  });
}

export function createFlowRuntimeSummaries(
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>,
  options: CreateFlowRuntimeSummaryOptions = {}
): DiscoveredFlowRuntimeSummary[] {
  return normalizeDiscoveredFlowsWithMetadata(flows).map((flow) =>
    createFlowRuntimeSummary(flow, options)
  );
}

export function createFlowCoordinationConfigFromFlows(
  options: CreateFlowCoordinationConfigFromFlowsOptions
): ResolvedCoordinationConfig {
  const flows = normalizeDiscoveredFlows(options.flows);
  const flowEntries: Record<
    string,
    { defaultStep: string; finalStep: string; onComplete?: string; steps: string[] }
  > = {};
  const routes: Record<string, RouteCoordinationConfig> = {};

  for (const flow of flows) {
    flowEntries[flow.id] = {
      defaultStep: String(flow.initialStep),
      finalStep: String(flow.finalStep),
      ...(flow.onComplete ? { onComplete: flow.onComplete } : {}),
      steps: Object.keys(flow.steps)
    };

    if (!flow.miniApp) {
      continue;
    }

    if (routes[flow.miniApp.route]) {
      throw new Error(`Duplicate flow route "${flow.miniApp.route}" discovered.`);
    }

    routes[flow.miniApp.route] = {
      entryPoints: Object.freeze([
        ...(flow.miniApp.entryPoints ?? []),
        ...(flow.bot?.command
          ? [
              {
                command: flow.bot.command.command,
                type: "bot_command" as const
              }
            ]
          : [])
      ]),
      flow: {
        entryStep: flow.bot?.command?.entryStep ?? String(flow.initialStep),
        flowId: flow.id,
        ...(flow.miniApp.requestWriteAccess ? { requestWriteAccess: true } : {})
      },
      returnToChat: flow.miniApp.returnToChat ?? options.returnToChat,
      stepRoutes: flow.miniApp.stepRoutes
    };
  }

  return defineCoordinationConfig({
    defaults: {
      ...DEFAULT_COORDINATION_DEFAULTS,
      ...(options.defaults ?? {})
    },
    flows: flowEntries,
    routes
  });
}

export function createFlowRoutes(options: CreateFlowRoutesOptions): RouteDefinition[] {
  const flows = normalizeDiscoveredFlows(options.flows);
  const coordination = createFlowCoordinationConfigFromFlows({
    defaults: options.defaults,
    flows,
    returnToChat: options.returnToChat
  });
  const routes = [...(options.routes ?? [])];
  const seenPaths = new Set(routes.map((route) => route.path));

  for (const flow of flows) {
    if (!flow.miniApp) {
      continue;
    }

    const resolvedRoute = coordination.resolveRoute(flow.miniApp.route);

    if (!resolvedRoute) {
      throw new Error(
        `Unable to derive route metadata for flow "${flow.id}" at path "${flow.miniApp.route}".`
      );
    }

    if (seenPaths.has(flow.miniApp.route)) {
      throw new Error(`Duplicate route path "${flow.miniApp.route}" while deriving flow routes.`);
    }

    routes.push({
      ...(flow.miniApp.capabilities ? { capabilities: flow.miniApp.capabilities } : {}),
      ...(flow.miniApp.component ? { component: flow.miniApp.component } : {}),
      coordination: resolvedRoute.metadata,
      ...(flow.miniApp.description ? { description: flow.miniApp.description } : {}),
      ...(flow.miniApp.guards ? { guards: [...flow.miniApp.guards] } : {}),
      ...(flow.miniApp.launchModes ? { launchModes: [...flow.miniApp.launchModes] } : {}),
      ...(flow.miniApp.meta ? { meta: { ...flow.miniApp.meta } } : {}),
      path: flow.miniApp.route,
      ...(flow.miniApp.title ? { title: flow.miniApp.title } : {}),
      ...(flow.miniApp.ui ? { ui: structuredClone(flow.miniApp.ui) } : {})
    });
    seenPaths.add(flow.miniApp.route);
  }

  return routes;
}

function resolveFlowRoot(options: DiscoverFlowFilesOptions): string {
  return options.root ?? options.app?.flows?.root ?? DEFAULT_FLOW_ROOT;
}

function resolveFlowHandlersRoot(options: DiscoverFlowHandlerFilesOptions): string {
  if (options.root) {
    return options.root;
  }

  if (options.app?.flows?.handlersRoot) {
    return options.app.flows.handlersRoot;
  }

  return deriveHandlersRootFromFlowRoot(options.app?.flows?.root ?? DEFAULT_FLOW_ROOT);
}

export function resolveFlowServerHooksRoot(options: DiscoverFlowServerHookFilesOptions): string {
  if (options.root) {
    return options.root;
  }

  if (options.app?.flows?.serverHooksRoot) {
    return options.app.flows.serverHooksRoot;
  }

  return deriveServerHooksRootFromFlowRoot(options.app?.flows?.root ?? DEFAULT_FLOW_ROOT);
}

async function collectFilesBySuffix(root: string, suffixes: readonly string[]): Promise<string[]> {
  const entries = await readdir(root, {
    withFileTypes: true
  });
  const files: string[] = [];

  for (const entry of entries) {
    const target = path.join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFilesBySuffix(target, suffixes)));
      continue;
    }

    if (suffixes.some((suffix) => entry.name.endsWith(suffix))) {
      files.push(target);
    }
  }

  files.sort();
  return files;
}

async function collectFlowFiles(root: string): Promise<string[]> {
  return collectFilesBySuffix(root, FLOW_FILE_SUFFIXES);
}

async function loadFlowDefinition(filePath: string): Promise<AnyFlowDefinition> {
  const loaded = await import(pathToFileURL(filePath).href);
  const candidate = loaded.default ?? loaded.flow;

  if (!isFlowDefinition(candidate)) {
    throw new Error(
      `Flow module "${filePath}" must export a flow definition as the default export or named "flow" export.`
    );
  }

  return candidate;
}

async function loadScreenDefinition(filePath: string): Promise<DiscoveredScreenModule["screen"]> {
  const module = await import(pathToFileURL(filePath).href);
  const screen = module.default;

  if (!screen || typeof screen !== "object" || typeof screen.id !== "string") {
    throw new Error(`Screen module "${filePath}" must default-export a screen definition.`);
  }

  return Object.freeze(screen);
}

async function loadFlowHandlerModule(
  filePath: string,
  flowId: string,
  stepId: string
): Promise<DiscoveredFlowStepHandlerModule> {
  const loaded = await import(pathToFileURL(filePath).href);
  const candidate = loaded.default ?? loaded.handler ?? loaded.stepHandler ?? loaded;
  const module =
    candidate &&
    typeof candidate === "object" &&
    "default" in candidate &&
    candidate.default &&
    typeof candidate.default === "object"
      ? candidate.default
      : candidate;

  if (!module || typeof module !== "object") {
    throw new Error(
      `Flow handler module "${filePath}" must export an object or named handler exports.`
    );
  }

  const actions: Record<string, DiscoveredHandlerFunction> =
    "actions" in module && module.actions && typeof module.actions === "object"
      ? (Object.fromEntries(
          Object.entries(module.actions as Record<string, unknown>).filter(
            ([key, value]) => typeof key === "string" && typeof value === "function"
          )
        ) as Record<string, DiscoveredHandlerFunction>)
      : {};

  return Object.freeze({
    actions: Object.freeze(actions),
    filePath,
    flowId,
    ...(typeof module.onEnter === "function"
      ? { onEnter: module.onEnter as DiscoveredHandlerFunction }
      : {}),
    ...(typeof module.onSubmit === "function"
      ? { onSubmit: module.onSubmit as DiscoveredHandlerFunction }
      : {}),
    stepId
  });
}

async function loadFlowServerHookModule(
  filePath: string,
  flowId: string,
  stepId: string
): Promise<DiscoveredFlowStepServerHookModule> {
  const loaded = await import(pathToFileURL(filePath).href);
  const candidate = loaded.default ?? loaded.serverHook ?? loaded.stepServerHook ?? loaded;
  const module =
    candidate &&
    typeof candidate === "object" &&
    "default" in candidate &&
    candidate.default &&
    typeof candidate.default === "object"
      ? candidate.default
      : candidate;

  if (!module || typeof module !== "object") {
    throw new Error(
      `Flow server-hook module "${filePath}" must export an object or named hook exports.`
    );
  }

  const actions: Record<string, DiscoveredHandlerFunction> =
    "actions" in module && module.actions && typeof module.actions === "object"
      ? (Object.fromEntries(
          Object.entries(module.actions as Record<string, unknown>).filter(
            ([key, value]) => typeof key === "string" && typeof value === "function"
          )
        ) as Record<string, DiscoveredHandlerFunction>)
      : {};

  return Object.freeze({
    actions: Object.freeze(actions),
    filePath,
    flowId,
    ...(typeof module.guard === "function" ? { guard: module.guard as DiscoveredHandlerFunction } : {}),
    ...(typeof module.loader === "function"
      ? { loader: module.loader as DiscoveredHandlerFunction }
      : {}),
    ...(typeof module.onSubmit === "function"
      ? { onSubmit: module.onSubmit as DiscoveredHandlerFunction }
      : {}),
    stepId
  });
}

function isFlowDefinition(value: unknown): value is AnyFlowDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "initialStep" in value &&
    typeof value.initialStep === "string" &&
    "steps" in value &&
    typeof value.steps === "object" &&
    value.steps !== null
  );
}

function normalizeDiscoveredFlows(
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>
): AnyFlowDefinition[] {
  const normalized: AnyFlowDefinition[] = [];

  for (const item of flows) {
    normalized.push("flow" in item ? item.flow : item);
  }

  return normalized;
}

function normalizeDiscoveredFlowsWithMetadata(
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>
): Array<AnyFlowDefinition | DiscoveredFlowModule> {
  const normalized: Array<AnyFlowDefinition | DiscoveredFlowModule> = [];

  for (const item of flows) {
    normalized.push(item);
  }

  return normalized;
}

function createFlowHandlerIndex(
  handlers: Iterable<DiscoveredFlowStepHandlerModule>
): Map<string, DiscoveredFlowStepHandlerModule> {
  const index = new Map<string, DiscoveredFlowStepHandlerModule>();

  for (const handler of handlers) {
    index.set(`${handler.flowId}:${handler.stepId}`, handler);
  }

  return index;
}

function createFlowServerHookIndex(
  serverHooks: Iterable<DiscoveredFlowStepServerHookModule>
): Map<string, DiscoveredFlowStepServerHookModule> {
  const index = new Map<string, DiscoveredFlowStepServerHookModule>();

  for (const hook of serverHooks) {
    index.set(`${hook.flowId}:${hook.stepId}`, hook);
  }

  return index;
}

function deriveHandlersRootFromFlowRoot(flowRoot: string): string {
  const normalized = flowRoot.replace(/\\/g, "/");
  if (normalized.endsWith("/flows")) {
    return normalized.replace(/\/flows$/, "/flow-handlers");
  }

  return `${normalized}-handlers`;
}

function deriveServerHooksRootFromFlowRoot(flowRoot: string): string {
  const normalized = flowRoot.replace(/\\/g, "/");

  if (normalized.includes("/bot/") && normalized.endsWith("/flows")) {
    return normalized.replace("/bot/", "/api/").replace(/\/flows$/, "/flow-hooks");
  }

  if (normalized.endsWith("/flows")) {
    return normalized.replace(/\/flows$/, "/flow-hooks");
  }

  return "apps/api/src/flow-hooks";
}

function stripKnownExtension(fileName: string, extensions: readonly string[]): string {
  for (const extension of extensions) {
    if (fileName.endsWith(extension)) {
      return fileName.slice(0, -extension.length);
    }
  }

  return fileName;
}

function isMissingPathError(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && error.code === "ENOENT";
}

async function resolveFlowScopedValue<T>(
  value: T | ((context: CommandContext, flow: AnyFlowDefinition) => Promise<T> | T) | undefined,
  context: CommandContext,
  flow: AnyFlowDefinition
): Promise<T | undefined> {
  if (typeof value === "function") {
    return (value as (context: CommandContext, flow: AnyFlowDefinition) => Promise<T> | T)(
      context,
      flow
    );
  }

  return value;
}

async function resolveFlowScopedRequiredValue<T>(
  value: T | ((context: CommandContext, flow: AnyFlowDefinition) => Promise<T> | T),
  context: CommandContext,
  flow: AnyFlowDefinition
): Promise<T> {
  return (await resolveFlowScopedValue(value, context, flow)) as T;
}
