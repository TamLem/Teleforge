import { UserFlowStateManager, createFlowStorage } from "@teleforgex/core";

import { loadTeleforgeApp } from "./config.js";

import type { TeleforgeAppConfig } from "@teleforgex/core";

export interface TeleforgeRuntimeContext {
  app: TeleforgeAppConfig;
  cwd: string;
  flowSecret: string;
  miniAppUrl: string;
  phoneAuthSecret?: string;
  services?: unknown;
  storage: UserFlowStateManager;
  /** Resolved bot token from the environment, if present. */
  token?: string;
}

export interface CreateTeleforgeRuntimeContextOptions {
  /** Pre-loaded app config. When omitted, config is loaded from cwd. */
  app?: TeleforgeAppConfig;
  cwd?: string;
  /** Explicit flow secret. Overrides env resolution. */
  flowSecret?: string;
  /** Explicit Mini App URL. Overrides env resolution. */
  miniAppUrl?: string;
  /** Explicit phone-auth secret. Overrides env resolution. */
  phoneAuthSecret?: string;
  /** Services container passed to runtime handlers. */
  services?: unknown;
  /** Pre-built storage. When omitted, an in-memory store is created. */
  storage?: UserFlowStateManager;
  /** TTL for auto-created in-memory storage, in seconds. Defaults to 900. */
  storageTtlSeconds?: number;
}

/**
 * Creates a shared runtime context that resolves config, secrets, and storage
 * once so it can be reused across bot bootstrap, server bootstrap, and dev
 * tooling without redundant initialization.
 */
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

  if (token) {
    if (delivery === "webhook") {
      throw new Error(
        "startTeleforgeBot live mode does not yet support webhook delivery. Use polling or the lower-level createDiscoveredBotRuntime() escape hatch."
      );
    }
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

  const storage =
    options.storage ??
    new UserFlowStateManager(
      createFlowStorage({
        backend: "memory",
        defaultTTL: options.storageTtlSeconds ?? 900,
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
    storage,
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
