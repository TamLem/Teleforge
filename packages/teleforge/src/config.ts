import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

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

    return JSON.parse(stdout) as TeleforgeAppConfig;
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
    const message =
      stderr.trim() ||
      (error instanceof Error ? error.message : `Failed to load ${path.basename(appPath)}.`);

    throw new Error(`Failed to load ${path.basename(appPath)}: ${message}`);
  }
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
