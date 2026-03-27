import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createBotRuntime, type BotRuntime } from "@teleforge/bot";
import { config as loadDotenv } from "dotenv";

import { createStartCommand } from "./commands/start.js";
import { createTasksCommand } from "./commands/tasks.js";
import { createTaskShopFlowStateManager } from "./flowState.js";
import { createOrderCompletedHandler } from "./handlers/orderCompleted.js";

export interface TaskShopBotRuntimeOptions {
  coordinationSecret?: string;
  miniAppUrl?: string;
}

export interface TaskShopBotConfig {
  coordinationSecret: string;
  miniAppUrl: string;
  pollDebug: boolean;
  token?: string;
}

loadTaskShopEnv();

export function createTaskShopBotRuntime(options: TaskShopBotRuntimeOptions = {}): BotRuntime {
  const config = readTaskShopBotConfig(options);
  const flowStateManager = createTaskShopFlowStateManager();
  const runtime = createBotRuntime();

  runtime.registerCommands([
    createStartCommand(config.miniAppUrl, flowStateManager, config.coordinationSecret),
    createTasksCommand(flowStateManager)
  ]);
  runtime.router.onWebAppData(
    createOrderCompletedHandler(flowStateManager, config.coordinationSecret, config.miniAppUrl)
  );

  return runtime;
}

export function createDevBotRuntime(options: TaskShopBotRuntimeOptions = {}): BotRuntime {
  return createTaskShopBotRuntime(options);
}

export function readTaskShopBotConfig(options: TaskShopBotRuntimeOptions = {}): TaskShopBotConfig {
  return {
    coordinationSecret:
      readNonEmptyEnvValue(options.coordinationSecret) ??
      readNonEmptyEnv("COORDINATION_SECRET") ??
      "task-shop-preview-secret",
    miniAppUrl:
      readNonEmptyEnvValue(options.miniAppUrl) ??
      readNonEmptyEnv("MINI_APP_URL") ??
      "https://example.ngrok.app",
    pollDebug: isTruthyEnv(process.env.TASK_SHOP_POLL_DEBUG),
    token: readNonEmptyEnv("BOT_TOKEN")
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
