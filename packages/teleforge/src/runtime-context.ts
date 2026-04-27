import { MemorySessionStorageAdapter, SessionManager } from "@teleforgex/core";

import { loadTeleforgeApp } from "./config.js";

import type { TeleforgeAppConfig } from "@teleforgex/core";

export interface TeleforgeRuntimeContext {
  app: TeleforgeAppConfig;
  cwd: string;
  flowSecret: string;
  miniAppUrl: string;
  phoneAuthSecret?: string;
  services?: unknown;
  sessionManager: SessionManager;
  token?: string;
}

export interface CreateTeleforgeRuntimeContextOptions {
  app?: TeleforgeAppConfig;
  cwd?: string;
  flowSecret?: string;
  miniAppUrl?: string;
  phoneAuthSecret?: string;
  services?: unknown;
  sessionManager?: SessionManager;
  sessionTtlSeconds?: number;
}

export async function createTeleforgeRuntimeContext(
  options: CreateTeleforgeRuntimeContextOptions = {}
): Promise<TeleforgeRuntimeContext> {
  const cwd = options.cwd ?? process.cwd();
  const app = options.app ?? (await loadTeleforgeApp(cwd)).app;

  const tokenEnv = app.bot.tokenEnv;
  const token = readEnv(tokenEnv);
  const delivery = app.runtime.bot?.delivery ?? "polling";

  const rawFlowSecret = options.flowSecret ?? readEnv("TELEFORGE_FLOW_SECRET");
  const rawMiniAppUrl = options.miniAppUrl ?? readEnv("MINI_APP_URL");

  if (token && delivery === "webhook") {
    const webhookPath = app.bot.webhook?.path;
    const webhookSecretEnv = app.bot.webhook?.secretEnv;
    if (!webhookPath) {
      throw new Error(
        "Webhook delivery requires bot.webhook.path in teleforge.config.ts."
      );
    }
    if (!webhookSecretEnv) {
      throw new Error(
        "Webhook delivery requires bot.webhook.secretEnv in teleforge.config.ts."
      );
    }
    if (!rawFlowSecret) {
      throw new Error(
        `startTeleforgeBot requires TELEFORGE_FLOW_SECRET (or options.flowSecret) when webhook delivery is configured.`
      );
    }
    if (!rawMiniAppUrl) {
      throw new Error(
        `startTeleforgeBot requires MINI_APP_URL (or options.miniAppUrl) when webhook delivery is configured.`
      );
    }
  } else if (token) {
    if (!rawFlowSecret) {
      throw new Error(
        `startTeleforgeBot requires TELEFORGE_FLOW_SECRET (or options.flowSecret) when ${tokenEnv} is configured.`
      );
    }
    if (!rawMiniAppUrl) {
      throw new Error(
        `startTeleforgeBot requires MINI_APP_URL (or options.miniAppUrl) when ${tokenEnv} is configured.`
      );
    }
  }

  const flowSecret = rawFlowSecret ?? `${app.app.id}-preview-secret`;
  const miniAppUrl = rawMiniAppUrl ?? "https://example.ngrok.app";
  const phoneAuthSecretEnv = app.runtime.phoneAuth?.secretEnv ?? "PHONE_AUTH_SECRET";
  const phoneAuthSecret = options.phoneAuthSecret ?? readEnv(phoneAuthSecretEnv);

  const sessionManager =
    options.sessionManager ??
    new SessionManager(
      new MemorySessionStorageAdapter({
        defaultTTL: options.sessionTtlSeconds ?? 900,
        namespace: app.app.id
      })
    );

  return {
    app,
    cwd,
    flowSecret,
    miniAppUrl,
    phoneAuthSecret,
    services: options.services,
    sessionManager,
    token
  };
}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
