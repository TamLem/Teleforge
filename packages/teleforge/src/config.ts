import { access, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createFlowRoutes } from "./discovery.js";

import type { ActionFlowDefinition } from "./flow-definition.js";
import type { TeleforgeAppConfig } from "@teleforge/core";

const configCandidates = [
  "teleforge.config.ts",
  "teleforge.config.mts",
  "teleforge.config.js",
  "teleforge.config.mjs"
] as const;

export interface LoadedTeleforgeApp {
  app: TeleforgeAppConfig;
  appPath: string;
}

export async function loadTeleforgeApp(cwd: string): Promise<LoadedTeleforgeApp> {
  const appPath = await resolveTeleforgeConfigPath(cwd);

  if (!appPath) {
    throw new Error(
      `Teleforge app config was not found in "${cwd}". Expected one of: ${configCandidates.join(", ")}.`
    );
  }

  const app = await loadTeleforgeAppFromFile(appPath, cwd);

  return {
    app,
    appPath
  };
}

export async function resolveTeleforgeConfigPath(cwd: string): Promise<string | null> {
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

export async function loadTeleforgeAppFromFile(
  appPath: string,
  cwd = path.dirname(appPath)
): Promise<TeleforgeAppConfig> {
  // Load the config module directly in-process to preserve non-serializable
  // values like custom session storage adapters.
  const loaded = await importConfigModule(appPath, cwd);
  const config = resolveConfigExport(loaded);

  if (!config || typeof config !== "object") {
    throw new Error("teleforge.config must export a default Teleforge app config object.");
  }

  return deriveLoadedFlowRoutes(config, cwd);
}

async function importConfigModule(appPath: string, cwd: string): Promise<Record<string, unknown>> {
  // For TypeScript files, we need tsx registered to handle the import.
  // For JS/MJS files, we can import directly.
  const ext = path.extname(appPath);

  if (ext === ".ts" || ext === ".mts") {
    // Ensure tsx is registered before importing TS files
    const tsxUrl = resolveTsxImportUrl(cwd);
    await import(tsxUrl);
  }

  return import(pathToFileURL(appPath).href) as Promise<Record<string, unknown>>;
}

function resolveConfigExport(loaded: Record<string, unknown>): TeleforgeAppConfig | undefined {
  const candidate = loaded.default ?? loaded.app ?? loaded.config;

  // Handle module re-exports that wrap the config in another default
  if (
    candidate &&
    typeof candidate === "object" &&
    "default" in candidate &&
    candidate.default &&
    typeof candidate.default === "object"
  ) {
    return candidate.default as TeleforgeAppConfig;
  }

  return candidate as TeleforgeAppConfig | undefined;
}

async function deriveLoadedFlowRoutes(
  app: TeleforgeAppConfig,
  cwd: string
): Promise<TeleforgeAppConfig> {
  const explicitRoutes = [...(app.routes ?? [])];
  if (!app.flows) {
    return {
      ...app,
      routes: explicitRoutes
    };
  }

  const flows = await loadFlowModulesForConfig(cwd, app.flows.root ?? "flows");

  return {
    ...app,
    routes: createFlowRoutes({
      flows,
      routes: explicitRoutes
    })
  };
}

type LoadedRouteFlow = ActionFlowDefinition;

async function loadFlowModulesForConfig(cwd: string, root: string): Promise<LoadedRouteFlow[]> {
  const absoluteRoot = path.resolve(cwd, root);
  const files = await collectFlowFiles(absoluteRoot);
  const flows: LoadedRouteFlow[] = [];
  const seenIds = new Map<string, string>();

  // Ensure tsx is registered for TS flow files
  const tsxUrl = resolveTsxImportUrl(cwd);
  await import(tsxUrl);

  for (const file of files) {
    const loaded = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
    const candidate = loaded.default ?? loaded.flow;
    const flow = resolveFlowExport(candidate);

    if (!flow || typeof flow !== "object" || typeof flow.id !== "string") {
      throw new Error(
        `Flow module "${file}" must export a flow definition as the default export or named "flow" export.`
      );
    }

    if (seenIds.has(flow.id)) {
      throw new Error(
        `Duplicate flow id "${flow.id}" discovered in "${seenIds.get(flow.id)}" and "${file}".`
      );
    }

    seenIds.set(flow.id, file);
    flows.push(flow as LoadedRouteFlow);
  }

  return flows;
}

function resolveFlowExport(candidate: unknown): ActionFlowDefinition | undefined {
  if (
    candidate &&
    typeof candidate === "object" &&
    "default" in candidate &&
    candidate.default &&
    typeof candidate.default === "object"
  ) {
    return candidate.default as ActionFlowDefinition;
  }

  return candidate as ActionFlowDefinition | undefined;
}

async function collectFlowFiles(directory: string): Promise<string[]> {
  const suffixes = [".flow.ts", ".flow.mts", ".flow.js", ".flow.mjs"];
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      // Ignore missing directories, but re-throw other errors (permissions, etc.)
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(target);
        continue;
      }

      if (entry.isFile() && suffixes.some((suffix) => entry.name.endsWith(suffix))) {
        files.push(target);
      }
    }
  }

  await walk(directory);
  return files.sort();
}

function resolveTsxImportUrl(cwd: string): string {
  let moduleDir: string | undefined;

  try {
    moduleDir = path.dirname(fileURLToPath(import.meta.url));
  } catch {
    // import.meta.url may be unavailable in CJS bundles; fall back to cwd candidates only
  }

  const candidates = [
    path.join(cwd, "__teleforge_loader__.js"),
    path.join(process.cwd(), "__teleforge_loader__.js"),
    ...(moduleDir ? [path.join(moduleDir, "__teleforge_loader__.js")] : [])
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
