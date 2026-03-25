import { readFile } from "node:fs/promises";
import path from "node:path";

import { ManifestValidationError } from "../errors/ManifestValidationError.js";

import { validateManifest } from "./validate.js";

import type { TeleforgeManifest } from "./types.js";

export async function loadManifest(cwd: string): Promise<{
  manifest: TeleforgeManifest;
  manifestPath: string;
}> {
  const manifestPath = path.join(cwd, "teleforge.app.json");
  const manifest = await loadManifestFromFile(manifestPath);
  return {
    manifest,
    manifestPath
  };
}

export async function loadManifestFromFile(manifestPath: string): Promise<TeleforgeManifest> {
  let rawManifest: string;

  try {
    rawManifest = await readFile(manifestPath, "utf8");
  } catch {
    throw new Error(
      "No Teleforge project found. Run `teleforge init` or ensure you're in a project directory."
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawManifest);
  } catch (error) {
    throw new Error(formatJsonError(error, rawManifest));
  }

  const result = validateManifest(parsed);
  if (!result.success) {
    throw new ManifestValidationError(result.errors);
  }

  return result.data;
}

function formatJsonError(error: unknown, source: string): string {
  const message = error instanceof Error ? error.message : String(error);
  const positionMatch = message.match(/position\s+(\d+)/i);

  if (!positionMatch) {
    return `Invalid teleforge.app.json: ${message}`;
  }

  const position = Number.parseInt(positionMatch[1] ?? "0", 10);
  const preceding = source.slice(0, position);
  const lines = preceding.split(/\r?\n/);
  const line = lines.length;
  const column = (lines.at(-1)?.length ?? 0) + 1;
  return `Invalid teleforge.app.json at line ${line}, column ${column}: ${message}`;
}
