import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { defineCoordinationConfig } from "@teleforgex/core";

import { createFlowStartCommand } from "./flow.js";

import type { BotCommandDefinition, CommandContext } from "@teleforgex/bot";
import type {
  CoordinationDefaults,
  RouteCoordinationConfig,
  ResolvedCoordinationConfig,
  ReturnToChatMetadata,
  UserFlowStateManager
} from "@teleforgex/core";
import type {
  CreateFlowStartCommandOptions,
  FlowStepDefinition,
  TeleforgeFlowDefinition
} from "./flow.js";

type AnyFlowDefinition = TeleforgeFlowDefinition<
  unknown,
  unknown,
  Record<string, FlowStepDefinition<unknown, unknown>>
>;

const FLOW_FILE_SUFFIXES = [".flow.ts", ".flow.mts", ".flow.js", ".flow.mjs"] as const;
const DEFAULT_FLOW_ROOT = "flows";

export interface TeleforgeFlowConventions {
  root?: string;
}

export interface DiscoverFlowFilesOptions {
  app?: {
    flows?: TeleforgeFlowConventions;
  };
  cwd: string;
  root?: string;
}

export interface LoadTeleforgeFlowsOptions extends DiscoverFlowFilesOptions {}

export interface DiscoveredFlowModule {
  filePath: string;
  flow: AnyFlowDefinition;
}

export interface CreateFlowCommandsOptions {
  buttonText?:
    | string
    | ((context: CommandContext, flow: AnyFlowDefinition) => Promise<string | undefined> | string | undefined);
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>;
  messageOptions?: CreateFlowStartCommandOptions<unknown>["messageOptions"];
  requestWriteAccess?: boolean;
  returnText?:
    | string
    | ((context: CommandContext, flow: AnyFlowDefinition) => Promise<string | undefined> | string | undefined);
  secret: string;
  stayInChat?: boolean;
  storage: UserFlowStateManager;
  text?:
    | string
    | ((context: CommandContext, flow: AnyFlowDefinition) => Promise<string> | string);
  webAppUrl:
    | string
    | ((context: CommandContext, flow: AnyFlowDefinition) => Promise<string> | string);
}

export interface CreateFlowCoordinationConfigFromFlowsOptions {
  defaults?: Partial<CoordinationDefaults>;
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>;
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

export function createFlowCoordinationConfigFromFlows(
  options: CreateFlowCoordinationConfigFromFlowsOptions
): ResolvedCoordinationConfig {
  const flows = normalizeDiscoveredFlows(options.flows);
  const flowEntries: Record<string, { defaultStep: string; finalStep: string; onComplete?: string; steps: string[] }> =
    {};
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

function resolveFlowRoot(options: DiscoverFlowFilesOptions): string {
  return options.root ?? options.app?.flows?.root ?? DEFAULT_FLOW_ROOT;
}

async function collectFlowFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, {
    withFileTypes: true
  });
  const files: string[] = [];

  for (const entry of entries) {
    const target = path.join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFlowFiles(target)));
      continue;
    }

    if (FLOW_FILE_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) {
      files.push(target);
    }
  }

  files.sort();
  return files;
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

function isMissingPathError(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && error.code === "ENOENT";
}

async function resolveFlowScopedValue<T>(
  value:
    | T
    | ((context: CommandContext, flow: AnyFlowDefinition) => Promise<T> | T)
    | undefined,
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
