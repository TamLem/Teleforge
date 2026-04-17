import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import {
  loadManifest as loadCoreManifest,
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

export interface TeleforgeManifest extends Omit<CoreTeleforgeManifest, "runtime"> {
  runtime: Omit<CoreTeleforgeManifest["runtime"], "webFramework"> & {
    webFramework: "vite" | "nextjs";
  };
}

/**
 * Loads a Teleforge manifest from disk and narrows the runtime to the web frameworks supported by
 * `@teleforgex/devtools`.
 */
export async function loadManifest(
  cwd: string
): Promise<{ manifest: TeleforgeManifest; manifestPath: string }> {
  const configState = await tryLoadTeleforgeConfig(cwd);
  const loaded = configState ?? (await loadCoreManifest(cwd));
  const { manifest, manifestPath } = loaded;

  if (manifest.runtime.webFramework !== "vite" && manifest.runtime.webFramework !== "nextjs") {
    throw new Error(
      "Invalid Teleforge app config: runtime.webFramework is not supported by @teleforgex/devtools."
    );
  }

  return {
    manifest: {
      ...manifest,
      runtime: {
        ...manifest.runtime,
        webFramework: manifest.runtime.webFramework
      }
    },
    manifestPath
  };
}

async function tryLoadTeleforgeConfig(
  cwd: string
): Promise<{ manifest: CoreTeleforgeManifest; manifestPath: string } | null> {
  const configPath = await resolveConfigPath(cwd);
  if (!configPath) {
    return null;
  }

  const config = await loadConfigModule(configPath, cwd);
  const hydratedConfig = await deriveConfigRoutes(config, cwd);
  const result = validateManifest(teleforgeAppToManifest(hydratedConfig));

  if (!result.success) {
    throw new Error(
      `Invalid ${path.basename(configPath)}: ${result.errors.map((issue) => issue.message).join("; ")}`
    );
  }

  return {
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
  const script = `
    import { pathToFileURL } from "node:url";

    const modulePath = process.argv[1];
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

    process.stdout.write(JSON.stringify(config));
  `;

  try {
    const tsxImportPath = resolveTsxImportPath(cwd);
    const { stdout } = await execFileAsync(
      process.execPath,
      ["--import", tsxImportPath, "--input-type=module", "--eval", script, configPath],
      {
        cwd,
        env: process.env
      }
    );

    return JSON.parse(stdout) as TeleforgeAppConfig;
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
    const message =
      stderr.trim() ||
      (error instanceof Error ? error.message : `Failed to load ${path.basename(configPath)}.`);
    throw new Error(`Failed to load ${path.basename(configPath)}: ${message}`);
  }
}

async function deriveConfigRoutes(
  config: TeleforgeAppConfig,
  cwd: string
): Promise<TeleforgeAppConfig> {
  const explicitRoutes = [...(config.routes ?? [])];
  if (!config.flows) {
    return {
      ...config,
      routes: explicitRoutes
    };
  }

  const flows = await loadFlowModules({
    cwd,
    root: config.flows.root ?? "flows"
  });

  return {
    ...config,
    routes: createRoutesFromFlows(flows, explicitRoutes)
  };
}

interface RouteFlowDefinition {
  bot?: {
    command?: {
      command: string;
      entryStep?: string;
    };
  };
  id: string;
  initialStep: string;
  miniApp?: {
    capabilities?: RouteDefinition["capabilities"];
    component?: string;
    description?: string;
    entryPoints?: LaunchEntryPoint[];
    guards?: string[];
    launchModes?: Array<"compact" | "fullscreen" | "inline">;
    meta?: RouteDefinition["meta"];
    requestWriteAccess?: boolean;
    returnToChat?: {
      stayInChat?: boolean;
      text: string;
    };
    route: string;
    stepRoutes?: Record<string, string>;
    title?: string;
    ui?: RouteDefinition["ui"];
  };
  steps: Record<string, unknown>;
}

async function loadFlowModules(options: {
  cwd: string;
  root: string;
}): Promise<RouteFlowDefinition[]> {
  const script = `
    import { readdir } from "node:fs/promises";
    import path from "node:path";
    import { pathToFileURL } from "node:url";

    const cwd = process.argv[1];
    const root = process.argv[2];
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
      flows.push(flow);
    }

    process.stdout.write(JSON.stringify(flows));
  `;

  try {
    const tsxImportPath = resolveTsxImportPath(options.cwd);
    const { stdout } = await execFileAsync(
      process.execPath,
      ["--import", tsxImportPath, "--input-type=module", "--eval", script, options.cwd, options.root],
      {
        cwd: options.cwd,
        env: process.env
      }
    );

    return JSON.parse(stdout) as RouteFlowDefinition[];
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
    const message =
      stderr.trim() || (error instanceof Error ? error.message : "Failed to load Teleforge flows.");
    throw new Error(message);
  }
}

function createRoutesFromFlows(
  flows: RouteFlowDefinition[],
  explicitRoutes: RouteDefinition[]
): RouteDefinition[] {
  const routes = [...explicitRoutes];
  const seenPaths = new Set(routes.map((route) => route.path));

  for (const flow of flows) {
    if (!flow.miniApp) {
      continue;
    }

    if (seenPaths.has(flow.miniApp.route)) {
      throw new Error(`Duplicate route path "${flow.miniApp.route}" while deriving flow routes.`);
    }

    const entryPoints = [
      ...(flow.miniApp.entryPoints ?? []),
      ...(flow.bot?.command
        ? [
            {
              command: flow.bot.command.command,
              type: "bot_command" as const
            }
          ]
        : [])
    ];

    routes.push({
      ...(flow.miniApp.capabilities ? { capabilities: flow.miniApp.capabilities } : {}),
      ...(flow.miniApp.component ? { component: flow.miniApp.component } : {}),
      coordination: {
        entryPoints,
        flow: {
          entryStep: flow.bot?.command?.entryStep ?? String(flow.initialStep),
          flowId: flow.id,
          ...(flow.miniApp.requestWriteAccess ? { requestWriteAccess: true } : {})
        },
        ...(flow.miniApp.returnToChat ? { returnToChat: flow.miniApp.returnToChat } : {}),
        ...(flow.miniApp.stepRoutes ? { stepRoutes: flow.miniApp.stepRoutes } : {})
      },
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

function resolveTsxImportPath(cwd: string): string {
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
