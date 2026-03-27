import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createBotRuntime, type BotRuntime } from "@teleforge/bot";
import { config as loadDotenv } from "dotenv";

import { createStartCommand } from "./commands/start.js";

export interface StarterBotRuntimeOptions {
  miniAppUrl?: string;
}

export interface StarterBotConfig {
  miniAppUrl: string;
  token?: string;
}

loadStarterEnv();

export function createStarterBotRuntime(options: StarterBotRuntimeOptions = {}): BotRuntime {
  const config = readStarterBotConfig(options);
  const runtime = createBotRuntime();

  runtime.registerCommands([createStartCommand(config.miniAppUrl)]);
  return runtime;
}

export function createDevBotRuntime(options: StarterBotRuntimeOptions = {}): BotRuntime {
  return createStarterBotRuntime(options);
}

export function readStarterBotConfig(options: StarterBotRuntimeOptions = {}): StarterBotConfig {
  return {
    miniAppUrl:
      readNonEmptyEnvValue(options.miniAppUrl) ??
      readNonEmptyEnv("MINI_APP_URL") ??
      "https://example.ngrok.app",
    token: readNonEmptyEnv("BOT_TOKEN")
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
