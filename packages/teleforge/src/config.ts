import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { createFlowRoutes } from "./discovery.js";

import type { ActionFlowDefinition } from "./flow-definition.js";
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
          TELEFORGE_CONFIG_PATH: appPath,
          TELEFORGE_OUTPUT_PATH: outputPath
        }
      }
    );

    const app = JSON.parse(await readFile(outputPath, "utf8")) as TeleforgeAppConfig;
    return deriveLoadedFlowRoutes(app, cwd);
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
    const message =
      stderr.trim() ||
      (error instanceof Error ? error.message : `Failed to load ${path.basename(appPath)}.`);

    throw new Error(`Failed to load ${path.basename(appPath)}: ${message}`);
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
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

type LoadedRouteFlow = ActionFlowDefinition;

async function loadFlowModulesForConfig(cwd: string, root: string): Promise<LoadedRouteFlow[]> {
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
      flows.push(flow);
    }

    await writeFile(outputPath, JSON.stringify(flows));
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
          TELEFORGE_CWD: cwd,
          TELEFORGE_FLOWS_ROOT: root,
          TELEFORGE_OUTPUT_PATH: outputPath
        }
      }
    );

    return JSON.parse(await readFile(outputPath, "utf8")) as LoadedRouteFlow[];
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

function resolveTsxImportPath(cwd: string): string {
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
