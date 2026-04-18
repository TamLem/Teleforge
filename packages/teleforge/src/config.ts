import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { createFlowRoutes } from "./discovery.js";

import type { TeleforgeFlowDefinition } from "./flow.js";
import type { TeleforgeAppConfig } from "@teleforgex/core";

const execFileAsync = promisify(execFile);
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
      ["--import", tsxImportPath, "--input-type=module", "--eval", script, appPath],
      {
        cwd,
        env: process.env
      }
    );

    const app = JSON.parse(stdout) as TeleforgeAppConfig;
    return deriveLoadedFlowRoutes(app, cwd);
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
    const message =
      stderr.trim() ||
      (error instanceof Error ? error.message : `Failed to load ${path.basename(appPath)}.`);

    throw new Error(`Failed to load ${path.basename(appPath)}: ${message}`);
  }
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

type LoadedRouteFlow = TeleforgeFlowDefinition<
  unknown,
  unknown,
  Record<string, import("./flow.js").FlowStepDefinition<unknown, unknown>>
>;

async function loadFlowModulesForConfig(cwd: string, root: string): Promise<LoadedRouteFlow[]> {
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

  const tsxImportPath = resolveTsxImportPath(cwd);
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--import", tsxImportPath, "--input-type=module", "--eval", script, cwd, root],
    {
      cwd,
      env: process.env
    }
  );

  return JSON.parse(stdout) as LoadedRouteFlow[];
}

function resolveTsxImportPath(cwd: string): string {
  const candidates = [
    path.join(cwd, "__teleforge_loader__.js"),
    path.join(process.cwd(), "__teleforge_loader__.js")
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
