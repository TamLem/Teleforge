import { MemorySessionStorageAdapter, SessionManager } from "@teleforgex/core";
import type { SessionStorageAdapter } from "@teleforgex/core";

import { loadTeleforgeApp } from "./config.js";
import { loadTeleforgeFlows } from "./discovery.js";

import type { TeleforgeAppConfig, TeleforgeSessionProviderConfig } from "@teleforgex/core";

export function createSessionManagerFromConfig(
  config: TeleforgeSessionProviderConfig | undefined,
  appId: string,
  options?: {
    mode?: "development" | "production";
    sessionEnabledFlows?: string[];
  }
): SessionManager {
  const mode = options?.mode ?? "development";
  const sessionEnabledFlows = options?.sessionEnabledFlows ?? [];

  // In production mode, require explicit session config when flows use sessions
  if (mode === "production" && sessionEnabledFlows.length > 0 && !config) {
    const flowList = sessionEnabledFlows.length === 1
      ? `"${sessionEnabledFlows[0]}"`
      : `${sessionEnabledFlows.slice(0, -1).map(f => `"${f}"`).join(", ")} and "${sessionEnabledFlows[sessionEnabledFlows.length - 1]}"`;

    throw new Error(
      `Flow ${flowList} enables sessions, but teleforge.config.ts has no session provider. ` +
      `Add session: { provider: "memory" } for local-only state or configure a durable provider for production.`
    );
  }

  if (!config) {
    return new SessionManager(
      new MemorySessionStorageAdapter({
        defaultTTL: 900,
        namespace: appId
      })
    );
  }

  if (config.provider === "memory") {
    const defaultTTL = config.defaultTTLSeconds ?? 900;
    const namespace = config.namespace ?? appId;
    return new SessionManager(
      new MemorySessionStorageAdapter({
        defaultTTL,
        namespace
      })
    );
  }

  // provider === "custom"
  // For custom providers: config TTL/namespace override adapter when specified, but fall back to adapter if not
  const defaultTTL = config.defaultTTLSeconds ?? config.storage.defaultTTL ?? 900;

  // Namespace: config overrides adapter when explicitly specified
  // If config.namespace is undefined, fall back to adapter.namespace, then appId
  const configuredNamespace = config.namespace;
  const namespace = configuredNamespace ?? config.storage.namespace ?? appId;

  // Only let adapter own namespacing if config didn't specify one AND adapter has a namespace
  const adapterOwnsNamespace = configuredNamespace === undefined && config.storage.namespace !== undefined;

  const wrappedAdapter = createWrappedAdapter(config.storage, defaultTTL, namespace, adapterOwnsNamespace);
  return new SessionManager(wrappedAdapter);
}

function createWrappedAdapter(
  adapter: SessionStorageAdapter,
  defaultTTL: number,
  namespace: string,
  adapterOwnsNamespace: boolean
): SessionStorageAdapter {
  // The resolved TTL and namespace already encode config > adapter > framework defaults.
  return {
    get defaultTTL() { return defaultTTL; },
    get namespace() { return namespace; },

    async delete(key: string) {
      const namespacedKey = adapterOwnsNamespace ? key : (namespace ? `${namespace}:${key}` : key);
      return adapter.delete(namespacedKey);
    },

    async get(key: string) {
      const namespacedKey = adapterOwnsNamespace ? key : (namespace ? `${namespace}:${key}` : key);
      return adapter.get(namespacedKey);
    },

    async set(key: string, value: string, ttl?: number) {
      const namespacedKey = adapterOwnsNamespace ? key : (namespace ? `${namespace}:${key}` : key);
      return adapter.set(namespacedKey, value, ttl ?? defaultTTL);
    },

    async touch(key: string, ttl: number) {
      const namespacedKey = adapterOwnsNamespace ? key : (namespace ? `${namespace}:${key}` : key);
      return adapter.touch(namespacedKey, ttl);
    },

    ...(adapter.compareAndSet ? {
      async compareAndSet(key: string, expectedRevision: number, value: string, ttl?: number) {
        const namespacedKey = adapterOwnsNamespace ? key : (namespace ? `${namespace}:${key}` : key);
        return adapter.compareAndSet!(namespacedKey, expectedRevision, value, ttl ?? defaultTTL);
      }
    } : {})
  };
}

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
  /** Skip session requirement validation. Defaults to false. */
  skipSessionValidation?: boolean;
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

  // Discover session-enabled flows for validation
  let sessionEnabledFlows: string[] = [];
  if (!options.skipSessionValidation && app.flows) {
    const flows = await loadTeleforgeFlows({ app, cwd });
    sessionEnabledFlows = flows
      .filter(({ flow }) => flow.session?.enabled)
      .map(({ flow }) => flow.id);
  }

  // Determine mode based on whether we have a production token
  const mode = token ? "production" : "development";

  const sessionManager =
    options.sessionManager ??
    createSessionManagerFromConfig(app.session, app.app.id, {
      mode,
      sessionEnabledFlows
    });

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
