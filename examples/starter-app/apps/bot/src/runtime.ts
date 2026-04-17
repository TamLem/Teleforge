import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createDiscoveredBotRuntime } from "teleforge";
import { type BotRuntime } from "teleforge/bot";
import { config as loadDotenv } from "dotenv";

export interface StarterBotRuntimeOptions {
  flowSecret?: string;
  miniAppUrl?: string;
  workspaceRoot?: string;
}

export interface StarterBotConfig {
  flowSecret: string;
  miniAppUrl: string;
  token?: string;
  workspaceRoot: string;
}

loadStarterEnv();

export function createStarterBotRuntime(options: StarterBotRuntimeOptions = {}): Promise<BotRuntime> {
  const config = readStarterBotConfig(options);

  return createDiscoveredBotRuntime({
    cwd: config.workspaceRoot,
    flowSecret: config.flowSecret,
    miniAppUrl: config.miniAppUrl
  });
}

export async function createDevBotRuntime(
  options: StarterBotRuntimeOptions = {}
): Promise<BotRuntime> {
  return createStarterBotRuntime(options);
}

export function readStarterBotConfig(options: StarterBotRuntimeOptions = {}): StarterBotConfig {
  const workspaceRoot =
    readNonEmptyEnvValue(options.workspaceRoot) ??
    resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

  return {
    flowSecret:
      readNonEmptyEnvValue(options.flowSecret) ??
      readNonEmptyEnv("TELEFORGE_FLOW_SECRET") ??
      "teleforge-starter-flow-secret",
    miniAppUrl:
      readNonEmptyEnvValue(options.miniAppUrl) ??
      readNonEmptyEnv("MINI_APP_URL") ??
      "https://example.ngrok.app",
    token: readNonEmptyEnv("BOT_TOKEN"),
    workspaceRoot
  };
}

function loadStarterEnv() {
  const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const envPaths = [resolve(workspaceRoot, ".env"), resolve(workspaceRoot, ".env.local")];

  for (const envPath of envPaths) {
    if (!existsSync(envPath)) {
      continue;
    }

    loadDotenv({
      override: envPath.endsWith(".env.local"),
      path: envPath
    });
  }
}

function readNonEmptyEnv(name: string): string | undefined {
  return readNonEmptyEnvValue(process.env[name]);
}

function readNonEmptyEnvValue(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function hasUsableToken(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();
  return (
    trimmed.includes(":") && !normalized.includes("your_") && !normalized.includes("placeholder")
  );
}
