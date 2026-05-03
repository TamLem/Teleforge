import {
  MemorySessionStorageAdapter,
  SessionManager,
  resolveRuntimeDeployment,
  validateSessionDeployment
} from "@teleforge/core";

import { loadTeleforgeApp } from "./config.js";
import { loadTeleforgeFlows } from "./discovery.js";

import type { SessionStorageAdapter } from "@teleforge/core";
import type {
  TeleforgeAppConfig,
  TeleforgeDeploymentTopology,
  TeleforgeRuntimeDeployment,
  TeleforgeRuntimeEnvironment,
  TeleforgeSessionProviderConfig
} from "@teleforge/core";

export function createSessionManagerFromConfig(
  config: TeleforgeSessionProviderConfig | undefined,
  appId: string,
  options?: {
    environment?: TeleforgeRuntimeEnvironment;
    skipValidation?: boolean;
    sessionEnabledFlows?: string[];
    topology?: TeleforgeDeploymentTopology;
  }
): SessionManager {
  const environment = options?.environment ?? "development";
  const sessionEnabledFlows = options?.sessionEnabledFlows ?? [];
  const topology = options?.topology ?? "single-process";

  if (!options?.skipValidation) {
    assertSessionDeployment({
      environment,
      sessionConfig: config,
      sessionEnabledFlows,
      topology
    });
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
  const adapterOwnsNamespace =
    configuredNamespace === undefined && config.storage.namespace !== undefined;

  const wrappedAdapter = createWrappedAdapter(
    config.storage,
    defaultTTL,
    namespace,
    adapterOwnsNamespace
  );
  return new SessionManager(wrappedAdapter);
}

export function resolveTeleforgeRuntimeDeployment(
  app: TeleforgeAppConfig,
  env: Record<string, string | undefined> = process.env
): TeleforgeRuntimeDeployment {
  return resolveRuntimeDeployment(app.runtime, { env });
}

export function assertSessionDeployment(input: {
  environment: TeleforgeRuntimeEnvironment;
  sessionConfig?: Pick<TeleforgeSessionProviderConfig, "provider">;
  sessionEnabledFlows: readonly string[];
  topology: TeleforgeDeploymentTopology;
}): void {
  const result = validateSessionDeployment(input);
  if (result.ok) {
    return;
  }

  throw new Error(result.issues.map((issue) => `${issue.message} ${issue.remediation}`).join("\n"));
}

function createWrappedAdapter(
  adapter: SessionStorageAdapter,
  defaultTTL: number,
  namespace: string,
  adapterOwnsNamespace: boolean
): SessionStorageAdapter {
  // The resolved TTL and namespace already encode config > adapter > framework defaults.
  return {
    get defaultTTL() {
      return defaultTTL;
    },
    get namespace() {
      return namespace;
    },

    async delete(key: string) {
      const namespacedKey = adapterOwnsNamespace ? key : namespace ? `${namespace}:${key}` : key;
      return adapter.delete(namespacedKey);
    },

    async get(key: string) {
      const namespacedKey = adapterOwnsNamespace ? key : namespace ? `${namespace}:${key}` : key;
      return adapter.get(namespacedKey);
    },

    async set(key: string, value: string, ttl?: number) {
      const namespacedKey = adapterOwnsNamespace ? key : namespace ? `${namespace}:${key}` : key;
      return adapter.set(namespacedKey, value, ttl ?? defaultTTL);
    },

    async touch(key: string, ttl: number) {
      const namespacedKey = adapterOwnsNamespace ? key : namespace ? `${namespace}:${key}` : key;
      return adapter.touch(namespacedKey, ttl);
    },

    ...(adapter.compareAndSet
      ? {
          async compareAndSet(key: string, expectedRevision: number, value: string, ttl?: number) {
            const namespacedKey = adapterOwnsNamespace
              ? key
              : namespace
                ? `${namespace}:${key}`
                : key;
            return adapter.compareAndSet!(
              namespacedKey,
              expectedRevision,
              value,
              ttl ?? defaultTTL
            );
          }
        }
      : {})
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
      throw new Error("Webhook delivery requires bot.webhook.path in teleforge.config.ts.");
    }
    if (!webhookSecretEnv) {
      throw new Error("Webhook delivery requires bot.webhook.secretEnv in teleforge.config.ts.");
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

  const runtimeDeployment = resolveTeleforgeRuntimeDeployment(app);
  if (!options.skipSessionValidation) {
    assertSessionDeployment({
      ...runtimeDeployment,
      sessionConfig: app.session ?? (options.sessionManager ? { provider: "custom" } : undefined),
      sessionEnabledFlows
    });
  }

  const sessionManager =
    options.sessionManager ??
    createSessionManagerFromConfig(app.session, app.app.id, {
      ...runtimeDeployment,
      sessionEnabledFlows,
      skipValidation: true
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
