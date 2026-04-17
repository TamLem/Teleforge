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
  const result = validateManifest(teleforgeAppToManifest(config));

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

function resolveTsxImportPath(cwd: string): string {
  const candidates = [
    path.join(cwd, "__teleforge_loader__.js"),
    path.join(process.cwd(), "__teleforge_loader__.js"),
    path.join(path.dirname(fileURLToPath(import.meta.url)), "__teleforge_loader__.js")
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
