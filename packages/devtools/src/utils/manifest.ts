import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import {
  teleforgeAppToManifest,
  validateManifest,
  type LaunchEntryPoint,
  type RouteDefinition,
  type TeleforgeAppConfig,
  type TeleforgeManifest as CoreTeleforgeManifest
} from "@teleforgex/core";

const execFileAsync = promisify(execFile);
const configCandidates = [
  "teleforge.config.ts",
  "teleforge.config.mts",
  "teleforge.config.js",
  "teleforge.config.mjs"
] as const;

export type TeleforgeManifest = CoreTeleforgeManifest;

export interface DiscoveredTeleforgeFlowSummary {
  command?: string;
  filePath?: string;
  hasRuntimeHandlers: boolean;
  hasWiringGaps: boolean;
  id: string;
  route?: string;
  routeCount: number;
  actionCount: number;
  wiredStepCount: number;
  routes: readonly string[];
  actions: readonly DiscoveredTeleforgeFlowActionSummary[];
}

export interface DiscoveredTeleforgeFlowActionSummary {
  hasHandler: boolean;
  handlerSource: "inline" | "module" | "none" | "server";
  id: string;
  isResolved: boolean;
  label: string;
  resolution: "handler" | "transition" | "none";
  to?: string;
}

export interface DiscoveredTeleforgeFlowStepSummary {
  actionCount: number;
  actions: readonly DiscoveredTeleforgeFlowActionSummary[];
  discoveredActionHandlerIds: readonly string[];
  discoveredServerActionIds: readonly string[];
  extraServerActionIds: readonly string[];
  extraActionHandlerIds: readonly string[];
  handlerFile?: string;
  hasDiscoveredModule: boolean;
  hasOnEnter: boolean;
  hasOnSubmit: boolean;
  hasRuntimeWiring: boolean;
  hasServerHookModule: boolean;
  hasWiringGaps: boolean;
  id: string;
  resolvedActionCount: number;
  resolvedOnEnter: boolean;
  resolvedOnSubmit: boolean;
  resolvedServerGuard: boolean;
  resolvedServerLoader: boolean;
  resolvedServerSubmit: boolean;
  screen?: string;
  screenFilePath?: string;
  screenResolved?: boolean;
  screenTitle?: string;
  serverHookFile?: string;
  status: "passive" | "warning" | "wired";
  type: "chat" | "miniapp";
  unresolvedActionIds: readonly string[];
}

interface DiscoveredTeleforgeScreenSummary {
  filePath: string;
  id: string;
  title?: string;
}

/**
 * Loads a Teleforge app config from disk and derives the runtime manifest used by devtools.
 */
export async function loadManifest(cwd: string): Promise<{
  discoveredFlows: DiscoveredTeleforgeFlowSummary[];
  manifest: TeleforgeManifest;
  manifestPath: string;
}> {
  const configState = await tryLoadTeleforgeConfig(cwd);
  if (!configState) {
    throw new Error("No Teleforge project found. Add a teleforge.config.ts file.");
  }

  const { manifest, manifestPath } = configState;

  return {
    discoveredFlows: configState.discoveredFlows,
    manifest,
    manifestPath
  };
}

async function tryLoadTeleforgeConfig(cwd: string): Promise<{
  discoveredFlows: DiscoveredTeleforgeFlowSummary[];
  manifest: CoreTeleforgeManifest;
  manifestPath: string;
} | null> {
  const configPath = await resolveConfigPath(cwd);
  if (!configPath) {
    return null;
  }

  const config = await loadConfigModule(configPath, cwd);
  const flowModules = config.flows
    ? await loadFlowModules({
        cwd,
        root: config.flows.root ?? "flows"
      })
    : [];
  const flowRuntimeSummaries = config.flows
    ? await loadFlowRuntimeSummaries({
        app: config,
        cwd
      })
    : [];
  const screenSummaries = config.miniApp
    ? await loadScreenSummaries({
        app: config,
        cwd
      })
    : [];
  const hydratedConfig = deriveConfigRoutes(config, flowModules);
  const result = validateManifest(teleforgeAppToManifest(hydratedConfig));

  if (!result.success) {
    throw new Error(formatManifestValidationErrors(configPath, flowModules, result.errors));
  }

  return {
    discoveredFlows: summarizeFlows(flowModules, flowRuntimeSummaries, screenSummaries),
    manifest: result.data,
    manifestPath: configPath
  };
}

async function resolveConfigPath(cwd: string): Promise<string | null> {
  for (const candidate of configCandidates) {
    const candidatePath = path.join(cwd, candidate);
    try {
      await access(candidatePath);
      return candidatePath;
    } catch {
      continue;
    }
  }

  return null;
}

async function loadConfigModule(configPath: string, cwd: string): Promise<TeleforgeAppConfig> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-"));
  const outputPath = path.join(tmpDir, "output.json");

  const script = `
    import { pathToFileURL } from "node:url";
    import { writeFile } from "node:fs/promises";

    const modulePath = process.env.TELEFORGE_CONFIG_PATH;
    const outputPath = process.env.TELEFORGE_OUTPUT_PATH;
    if (!modulePath || !outputPath) {
      throw new Error("TELEFORGE_CONFIG_PATH and TELEFORGE_OUTPUT_PATH are required.");
    }

    const loaded = await import(pathToFileURL(modulePath).href);
    const candidate = loaded.default ?? loaded.app ?? loaded.config;
    const config =
      candidate &&
      typeof candidate === "object" &&
      "default" in candidate &&
      candidate.default &&
      typeof candidate.default === "object"
        ? candidate.default
        : candidate;

    if (!config || typeof config !== "object") {
      throw new Error("teleforge.config must export a default Teleforge app config object.");
    }

    await writeFile(outputPath, JSON.stringify(config));
  `;

  try {
    const tsxImportPath = resolveTsxImportPath(cwd);
    await execFileAsync(
      process.execPath,
      ["--import", tsxImportPath, "--input-type=module", "--eval", script],
      {
        cwd,
        env: {
          ...process.env,
          TELEFORGE_CONFIG_PATH: configPath,
          TELEFORGE_OUTPUT_PATH: outputPath
        }
      }
    );

    return JSON.parse(await readFile(outputPath, "utf8")) as TeleforgeAppConfig;
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
    const message =
      stderr.trim() ||
      (error instanceof Error ? error.message : `Failed to load ${path.basename(configPath)}.`);
    throw new Error(`Failed to load ${path.basename(configPath)}: ${message}`);
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

function deriveConfigRoutes(
  config: TeleforgeAppConfig,
  flows: RouteFlowDefinition[]
): TeleforgeAppConfig {
  const explicitRoutes = [...(config.routes ?? [])];
  if (!config.flows) {
    return {
      ...config,
      routes: explicitRoutes
    };
  }

  return {
    ...config,
    routes: createRoutesFromFlows(flows, explicitRoutes)
  };
}

interface RouteFlowDefinition {
  __filePath?: string;
  id: string;
  command?: {
    command: string;
    description: string;
  };
  miniApp?: {
    routes: Record<string, string>;
    defaultRoute?: string;
    title?: string;
  };
  actions?: Record<string, unknown>;
}

function summarizeFlows(
  flows: RouteFlowDefinition[],
  runtimeSummaries: readonly DiscoveredTeleforgeFlowSummary[],
  screenSummaries: readonly DiscoveredTeleforgeScreenSummary[]
): DiscoveredTeleforgeFlowSummary[] {
  const runtimeSummariesById = new Map(runtimeSummaries.map((summary) => [summary.id, summary]));
  const _screenSummariesById = new Map(screenSummaries.map((summary) => [summary.id, summary]));

  return flows.map((flow) => {
    const runtimeSummary = runtimeSummariesById.get(flow.id);
    const routeCount = Object.keys(flow.miniApp?.routes ?? {}).length;
    const actionCount = Object.keys(flow.actions ?? {}).length;
    const routes = Object.keys(flow.miniApp?.routes ?? {});
    const actions = (runtimeSummary?.actions ?? []).map((a) => ({
      hasHandler: a.hasHandler,
      handlerSource: a.hasHandler ? ("inline" as const) : ("none" as const),
      id: a.id,
      isResolved: a.hasHandler,
      label: a.id,
      resolution: a.hasHandler ? ("handler" as const) : ("none" as const)
    }));

    return {
      ...(flow.command?.command ? { command: flow.command.command } : {}),
      ...(flow.__filePath ? { filePath: flow.__filePath } : {}),
      hasRuntimeHandlers: runtimeSummary?.hasRuntimeHandlers ?? false,
      hasWiringGaps: false,
      id: flow.id,
      ...(flow.miniApp?.defaultRoute ? { route: flow.miniApp.defaultRoute } : {}),
      routeCount,
      actionCount,
      wiredStepCount: routeCount,
      routes,
      actions
    };
  });
}

async function loadFlowModules(options: {
  cwd: string;
  root: string;
}): Promise<RouteFlowDefinition[]> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-"));
  const outputPath = path.join(tmpDir, "output.json");

  const script = `
    import { readdir, writeFile } from "node:fs/promises";
    import path from "node:path";
    import { pathToFileURL } from "node:url";

    const cwd = process.env.TELEFORGE_CWD;
    const root = process.env.TELEFORGE_FLOWS_ROOT;
    const outputPath = process.env.TELEFORGE_OUTPUT_PATH;
    if (!cwd || !root || !outputPath) {
      throw new Error("TELEFORGE_CWD, TELEFORGE_FLOWS_ROOT, and TELEFORGE_OUTPUT_PATH are required.");
    }

    const suffixes = [".flow.ts", ".flow.mts", ".flow.js", ".flow.mjs"];

    async function collectFiles(directory) {
      const entries = await readdir(directory, { withFileTypes: true });
      const files = [];

      for (const entry of entries) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          files.push(...(await collectFiles(target)));
          continue;
        }

        if (suffixes.some((suffix) => entry.name.endsWith(suffix))) {
          files.push(target);
        }
      }

      return files.sort();
    }

    const absoluteRoot = path.resolve(cwd, root);
    let files = [];

    try {
      files = await collectFiles(absoluteRoot);
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
    }

    const flows = [];
    const seenIds = new Map();

    for (const file of files) {
      const loaded = await import(pathToFileURL(file).href);
      const candidate = loaded.default ?? loaded.flow;
      const flow =
        candidate &&
        typeof candidate === "object" &&
        "default" in candidate &&
        candidate.default &&
        typeof candidate.default === "object"
          ? candidate.default
          : candidate;

      if (!flow || typeof flow !== "object" || typeof flow.id !== "string") {
        throw new Error(
          'Flow module "' + file + '" must export a flow definition as the default export or named "flow" export.'
        );
      }

      if (seenIds.has(flow.id)) {
        throw new Error(
          'Duplicate flow id "' + flow.id + '" discovered in "' + seenIds.get(flow.id) + '" and "' + file + '".'
        );
      }

      seenIds.set(flow.id, file);
      flows.push({
        ...flow,
        __filePath: file
      });
    }

    await writeFile(outputPath, JSON.stringify(flows));
  `;

  try {
    const tsxImportPath = resolveTsxImportPath(options.cwd);
    await execFileAsync(
      process.execPath,
      ["--import", tsxImportPath, "--input-type=module", "--eval", script],
      {
        cwd: options.cwd,
        env: {
          ...process.env,
          TELEFORGE_CWD: options.cwd,
          TELEFORGE_FLOWS_ROOT: options.root,
          TELEFORGE_OUTPUT_PATH: outputPath
        }
      }
    );

    return JSON.parse(await readFile(outputPath, "utf8")) as RouteFlowDefinition[];
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
    const message =
      stderr.trim() || (error instanceof Error ? error.message : "Failed to load Teleforge flows.");
    throw new Error(message);
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

interface RuntimeFlowActionSummary {
  hasHandler: boolean;
  handlerSource: "inline" | "module" | "none" | "server";
  id: string;
  label: string;
  to?: string;
}

interface _RuntimeFlowStepSummary {
  actionCount: number;
  actions: readonly RuntimeFlowActionSummary[];
  discoveredActionHandlerIds: readonly string[];
  discoveredServerActionIds: readonly string[];
  handlerFile?: string;
  hasDiscoveredModule: boolean;
  hasServerHookModule: boolean;
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
  type: "chat" | "miniapp";
}

interface RuntimeFlowSummary {
  command?: string;
  filePath?: string;
  hasRuntimeHandlers: boolean;
  id: string;
  routeCount: number;
  actionCount: number;
  routes: readonly string[];
  actions: readonly { id: string; hasHandler: boolean; requiresSession: boolean }[];
  hasSession: boolean;
}

async function loadScreenSummaries(options: {
  app: TeleforgeAppConfig;
  cwd: string;
}): Promise<DiscoveredTeleforgeScreenSummary[]> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-"));
  const outputPath = path.join(tmpDir, "output.json");

  const script = `
    import { pathToFileURL } from "node:url";
    import { writeFile } from "node:fs/promises";

    const teleforgePath = process.env.TELEFORGE_PACKAGE_PATH;
    const cwd = process.env.TELEFORGE_CWD;
    const appPayload = process.env.TELEFORGE_APP_PAYLOAD;
    const outputPath = process.env.TELEFORGE_OUTPUT_PATH;
    if (!teleforgePath || !cwd || !appPayload || !outputPath) {
      throw new Error("TELEFORGE_PACKAGE_PATH, TELEFORGE_CWD, TELEFORGE_APP_PAYLOAD, and TELEFORGE_OUTPUT_PATH are required.");
    }
    const app = JSON.parse(appPayload);

    const teleforge = await import(pathToFileURL(teleforgePath).href);
    const screens = await teleforge.loadTeleforgeScreens({
      app,
      cwd
    });

    await writeFile(
      outputPath,
      JSON.stringify(
        screens.map((entry) => ({
          filePath: entry.filePath,
          id: entry.screen.id,
          title: entry.screen.title
        }))
      )
    );
  `;

  try {
    const tsxImportPath = resolveTsxImportPath(options.cwd);
    const teleforgeImportPath = resolveTeleforgeImportPath(options.cwd);
    await execFileAsync(
      process.execPath,
      ["--import", tsxImportPath, "--input-type=module", "--eval", script],
      {
        cwd: options.cwd,
        env: {
          ...process.env,
          TELEFORGE_APP_PAYLOAD: JSON.stringify({
            miniApp: options.app.miniApp
          }),
          TELEFORGE_CWD: options.cwd,
          TELEFORGE_PACKAGE_PATH: teleforgeImportPath,
          TELEFORGE_OUTPUT_PATH: outputPath
        }
      }
    );

    return JSON.parse(await readFile(outputPath, "utf8")) as DiscoveredTeleforgeScreenSummary[];
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
    const message =
      stderr.trim() ||
      (error instanceof Error ? error.message : "Failed to load Teleforge screen summaries.");
    throw new Error(message);
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function loadFlowRuntimeSummaries(options: {
  app: TeleforgeAppConfig;
  cwd: string;
}): Promise<DiscoveredTeleforgeFlowSummary[]> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-"));
  const outputPath = path.join(tmpDir, "output.json");

  const script = `
    import { pathToFileURL } from "node:url";
    import { writeFile } from "node:fs/promises";

    const teleforgePath = process.env.TELEFORGE_PACKAGE_PATH;
    const cwd = process.env.TELEFORGE_CWD;
    const appPayload = process.env.TELEFORGE_APP_PAYLOAD;
    const outputPath = process.env.TELEFORGE_OUTPUT_PATH;
    if (!teleforgePath || !cwd || !appPayload || !outputPath) {
      throw new Error("TELEFORGE_PACKAGE_PATH, TELEFORGE_CWD, TELEFORGE_APP_PAYLOAD, and TELEFORGE_OUTPUT_PATH are required.");
    }
    const app = JSON.parse(appPayload);

    const teleforge = await import(pathToFileURL(teleforgePath).href);
    const flows = await teleforge.loadTeleforgeFlows({
      app,
      cwd
    });
    const summaries = teleforge.createFlowRuntimeSummaries(flows);

    await writeFile(outputPath, JSON.stringify(summaries));
  `;

  try {
    const tsxImportPath = resolveTsxImportPath(options.cwd);
    const teleforgeImportPath = resolveTeleforgeImportPath(options.cwd);
    await execFileAsync(
      process.execPath,
      ["--import", tsxImportPath, "--input-type=module", "--eval", script],
      {
        cwd: options.cwd,
        env: {
          ...process.env,
          TELEFORGE_APP_PAYLOAD: JSON.stringify({
            flows: options.app.flows ?? {}
          }),
          TELEFORGE_CWD: options.cwd,
          TELEFORGE_PACKAGE_PATH: teleforgeImportPath,
          TELEFORGE_OUTPUT_PATH: outputPath
        }
      }
    );

    return createDiagnosticSummaries(JSON.parse(await readFile(outputPath, "utf8")) as RuntimeFlowSummary[]);
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
    const message =
      stderr.trim() ||
      (error instanceof Error ? error.message : "Failed to load Teleforge flow runtime summaries.");
    throw new Error(message);
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

function createDiagnosticSummaries(
  summaries: RuntimeFlowSummary[]
): DiscoveredTeleforgeFlowSummary[] {
  return summaries.map((summary) => {
    const actions = summary.actions.map((action) => ({
      hasHandler: action.hasHandler,
      handlerSource: action.hasHandler ? ("inline" as const) : ("none" as const),
      id: action.id,
      isResolved: action.hasHandler,
      label: action.id,
      resolution: action.hasHandler ? ("handler" as const) : ("none" as const)
    }));

    return Object.freeze({
      ...summary,
      hasWiringGaps: false,
      wiredStepCount: summary.routeCount,
      actions: Object.freeze(actions)
    });
  });
}

function createRoutesFromFlows(
  flows: RouteFlowDefinition[],
  explicitRoutes: RouteDefinition[]
): RouteDefinition[] {
  const routes = [...explicitRoutes];
  const seenPaths = new Set(routes.map((route) => route.path));

  for (const flow of flows) {
    if (!flow.miniApp?.routes) {
      continue;
    }

    for (const [routePath, screenId] of Object.entries(flow.miniApp.routes)) {
      if (seenPaths.has(routePath)) {
        throw new Error(`Duplicate route path "${routePath}" while deriving flow routes.`);
      }

      routes.push({
        coordination: {
          entryPoints: resolveMiniAppRouteEntryPoints(flow),
          flow: {
            entryStep: screenId,
            flowId: flow.id
          }
        },
        path: routePath,
        ...(flow.miniApp.title ? { title: flow.miniApp.title } : {})
      });
      seenPaths.add(routePath);
    }
  }

  return routes;
}

function resolveMiniAppRouteEntryPoints(flow: RouteFlowDefinition): LaunchEntryPoint[] {
  const entryPoints: LaunchEntryPoint[] = flow.command
    ? [{ command: flow.command.command, type: "bot_command" as const }]
    : [];

  return entryPoints.length > 0 ? entryPoints : [{ type: "miniapp" as const }];
}

export function resolveTsxImportPath(cwd: string): string {
  const candidates = [
    path.join(cwd, "__teleforge_loader__.js"),
    path.join(process.cwd(), "__teleforge_loader__.js"),
    path.join(resolveCurrentBundleDirectory(), "__teleforge_loader__.js")
  ];

  for (const basePath of candidates) {
    try {
      return pathToFileURL(createRequire(basePath).resolve("tsx")).href;
    } catch {
      continue;
    }
  }

  throw new Error(
    'Teleforge could not resolve the "tsx" loader needed to read teleforge.config.ts.'
  );
}

export function resolveTeleforgeImportPath(cwd: string): string {
  const requireCandidates = [
    path.join(cwd, "__teleforge_runtime__.js"),
    path.join(process.cwd(), "__teleforge_runtime__.js"),
    path.join(resolveCurrentBundleDirectory(), "__teleforge_runtime__.js")
  ];

  for (const basePath of requireCandidates) {
    try {
      return createRequire(basePath).resolve("teleforge");
    } catch {
      continue;
    }
  }

  const pathCandidates = [
    path.resolve(
      resolveCurrentBundleDirectory(),
      "..",
      "..",
      "..",
      "teleforge",
      "dist",
      "index.js"
    ),
    path.resolve(resolveCurrentBundleDirectory(), "..", "..", "..", "teleforge", "src", "index.ts"),
    path.resolve(process.cwd(), "..", "teleforge", "dist", "index.js"),
    path.resolve(process.cwd(), "..", "teleforge", "src", "index.ts")
  ];

  for (const candidate of pathCandidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'Teleforge could not resolve the unified "teleforge" package needed to inspect discovered flows.'
  );
}

function formatManifestValidationErrors(
  configPath: string,
  flowModules: RouteFlowDefinition[],
  errors: Array<{ message: string; path: string[] }>
): string {
  const emptyRoutesIssue = errors.find(
    (issue) => issue.path.length === 1 && issue.path[0] === "routes"
  );
  if (emptyRoutesIssue) {
    const flowIdsWithoutMiniAppRoutes = flowModules
      .filter((flow) => hasMiniAppStep(flow) && !flow.miniApp?.routes)
      .map((flow) => flow.id);
    const details =
      flowIdsWithoutMiniAppRoutes.length > 0
        ? [
            "No Mini App routes could be derived from discovered flows.",
            `Flows with Mini App screens but no flow-level miniApp.routes: ${flowIdsWithoutMiniAppRoutes.join(", ")}.`,
            "Add `miniApp: { routes: { \"/\": \"screenId\" } }` to each flow that owns Mini App screens."
          ]
        : [
            "No Mini App routes were found.",
            "Add a flow-level `miniApp.route`, define explicit `routes`, or remove `flows` if this project does not use flow discovery."
          ];
    return `Invalid ${path.basename(configPath)}:\n  - ${details.join("\n  - ")}`;
  }

  const formatted = errors.map((issue) => {
    const context = inferManifestIssueContext(issue.path, flowModules);
    return context ? `${context}: ${issue.message}` : issue.message;
  });
  return `Invalid ${path.basename(configPath)}:\n  - ${formatted.join("\n  - ")}`;
}

function hasMiniAppStep(flow: RouteFlowDefinition): boolean {
  return Boolean(flow.miniApp && Object.keys(flow.miniApp.routes ?? {}).length > 0);
}

function inferManifestIssueContext(
  pathSegments: string[],
  flowModules: RouteFlowDefinition[]
): string | undefined {
  if (pathSegments.length === 0) {
    return undefined;
  }

  const [top, ...rest] = pathSegments;

  if (top === "routes" && rest.length >= 1) {
    const routeIndex = Number.parseInt(rest[0], 10);
    const routeField = rest[1];
    const derivedFlowRoutes = flowModules
      .filter((f) => f.miniApp?.routes)
      .flatMap((f) =>
        Object.keys(f.miniApp!.routes).map((route) => ({
          flowId: f.id,
          route
        }))
      );

    if (!Number.isNaN(routeIndex)) {
      if (routeField === "coordination" && rest[2] === "entryPoints") {
        const matched = derivedFlowRoutes[routeIndex];
        if (matched) {
          return `Flow "${matched.flowId}" route "${matched.route}"`;
        }
        return `Route ${routeIndex}`;
      }

      if (routeField === "component") {
        return `Route ${routeIndex} component`;
      }

      return `Route ${routeIndex}${routeField ? ` ${routeField}` : ""}`;
    }

    return `Route ${rest.join(".")}`;
  }

  if (top === "bot") {
    return `Bot ${rest.join(".")}`;
  }

  if (top === "miniApp") {
    return `Mini App ${rest.join(".")}`;
  }

  if (top === "version") {
    return "App version";
  }

  if (top === "name") {
    return "App name";
  }

  if (top === "id") {
    return "App id";
  }

  if (top === "permissions") {
    return `Permission ${rest.join(".")}`;
  }

  return undefined;
}

function resolveCurrentBundleDirectory(): string {
  const originalPrepareStackTrace = Error.prepareStackTrace;

  try {
    Error.prepareStackTrace = (_, stack) => stack;
    const stack = new Error().stack as unknown as NodeJS.CallSite[] | undefined;

    for (const frame of stack ?? []) {
      const fileName = frame.getFileName();
      if (typeof fileName !== "string" || fileName.length === 0 || fileName.startsWith("node:")) {
        continue;
      }

      if (fileName.startsWith("file://")) {
        return path.dirname(fileURLToPath(fileName));
      }

      return path.dirname(fileName);
    }
  } finally {
    Error.prepareStackTrace = originalPrepareStackTrace;
  }

  return process.cwd();
}
