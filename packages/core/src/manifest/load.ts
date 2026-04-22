import { readFile } from "node:fs/promises";

import { ManifestValidationError } from "../errors/ManifestValidationError.js";

import { validateManifest } from "./validate.js";

import type { TeleforgeManifest } from "./types.js";

export async function loadManifest(cwd: string): Promise<{
  manifest: TeleforgeManifest;
  manifestPath: string;
}> {
  void cwd;
  throw new Error(
    "File-based Teleforge manifests are no longer supported. Use teleforge.config.ts."
  );
}

export async function loadManifestFromFile(manifestPath: string): Promise<TeleforgeManifest> {
  let rawManifest: string;

  try {
    rawManifest = await readFile(manifestPath, "utf8");
  } catch {
    throw new Error(`Unable to read Teleforge manifest file: ${manifestPath}`);
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
    return `Invalid Teleforge manifest JSON: ${message}`;
  }

  const position = Number.parseInt(positionMatch[1] ?? "0", 10);
  const preceding = source.slice(0, position);
  const lines = preceding.split(/\r?\n/);
  const line = lines.length;
  const column = (lines.at(-1)?.length ?? 0) + 1;
  return `Invalid Teleforge manifest JSON at line ${line}, column ${column}: ${message}`;
}
