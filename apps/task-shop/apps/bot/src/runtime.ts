import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";
import { createDiscoveredBotRuntime } from "teleforge";
import { type BotRuntime } from "teleforge/bot";

export interface TaskShopBotRuntimeOptions {
  flowSecret?: string;
  miniAppUrl?: string;
  workspaceRoot?: string;
}

export interface TaskShopBotConfig {
  flowSecret: string;
  miniAppUrl: string;
  pollDebug: boolean;
  token?: string;
  workspaceRoot: string;
}

loadTaskShopEnv();

export function createTaskShopBotRuntime(
  options: TaskShopBotRuntimeOptions = {}
): Promise<BotRuntime> {
  const config = readTaskShopBotConfig(options);

  return createDiscoveredBotRuntime({
    commandOptions: {
      stayInChat: true
    },
    cwd: config.workspaceRoot,
    flowSecret: config.flowSecret,
    miniAppUrl: config.miniAppUrl
  });
}

export async function createDevBotRuntime(
  options: TaskShopBotRuntimeOptions = {}
): Promise<BotRuntime> {
  return createTaskShopBotRuntime(options);
}

export function readTaskShopBotConfig(options: TaskShopBotRuntimeOptions = {}): TaskShopBotConfig {
  const workspaceRoot =
    readNonEmptyEnvValue(options.workspaceRoot) ??
    resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

  return {
    flowSecret:
      readNonEmptyEnvValue(options.flowSecret) ??
      readNonEmptyEnv("TELEFORGE_FLOW_SECRET") ??
      "task-shop-preview-secret",
    miniAppUrl:
      readNonEmptyEnvValue(options.miniAppUrl) ??
      readNonEmptyEnv("MINI_APP_URL") ??
      "https://example.ngrok.app",
    pollDebug: isTruthyEnv(process.env.TASK_SHOP_POLL_DEBUG),
    token: readNonEmptyEnv("BOT_TOKEN"),
    workspaceRoot
  };
}

function loadTaskShopEnv() {
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

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}
