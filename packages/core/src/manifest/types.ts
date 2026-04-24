import type { RouteCoordinationMetadata } from "../coordination/types.js";

/**
 * Describes the runtime behavior and framework wiring for a Teleforge application.
 */
export interface TeleforgeRuntime {
  apiPrefix?: string;
  apiRoutes?: string;
  build?: {
    basePath?: string;
    outDir?: string;
  };
  ssr?: boolean;
  bot?: {
    /** Telegram bot update delivery mode. Defaults to polling. */
    delivery?: "polling" | "webhook";
  };
  /** Production server-hooks server configuration. */
  server?: {
    /** Port for the hooks server. Defaults to 3100. */
    port?: number;
  };
  /** Phone-auth runtime configuration. */
  phoneAuth?: {
    /** Environment variable name for the phone-auth signing secret. Defaults to PHONE_AUTH_SECRET. */
    secretEnv?: string;
  };
}

/**
 * Defines a route-level capability gate in the Teleforge manifest.
 */
export interface TeleforgeRouteCapability {
  auth?: boolean;
  launchMode?: "inline" | "compact" | "fullscreen";
  payments?: boolean;
}

/**
 * Describes an addressable Mini App route and its UI/runtime requirements.
 */
export interface RouteDefinition {
  capabilities?: TeleforgeRouteCapability;
  component?: string;
  coordination?: RouteCoordinationMetadata;
  description?: string;
  guards?: string[];
  launchModes?: string[];
  meta?: {
    description?: string;
    title?: string;
  };
  path: string;
  title?: string;
  ui?: {
    header?: {
      hideBackButton?: boolean;
      title?: string;
    };
    mainButton?: {
      text: string;
      visible?: boolean;
    };
  };
}

/**
 * Defines a permission declaration exposed by the app manifest.
 */
export interface TeleforgePermission {
  capability?: string;
  description?: string;
  scope?: string;
}

/**
 * Canonical manifest shape for a Teleforge application.
 */
export interface TeleforgeManifest {
  $schema?: string;
  bot: {
    commands?: Array<{
      command: string;
      description?: string;
      handler?: string;
    }>;
    tokenEnv: string;
    username: string;
    webhook?: {
      path: string;
      secretEnv: string;
    };
  };
  build?: {
    outDir?: string;
    publicDir?: string;
  };
  dev?: {
    httpsPort?: number;
    port?: number;
    services?: Array<{
      command: string;
      health?: string;
      name: string;
    }>;
    tunnel?: boolean;
  };
  features?: {
    backButton?: boolean;
    cloudStorage?: boolean;
    hapticFeedback?: boolean;
    payments?: boolean;
    settingsButton?: boolean;
  };
  id: string;
  miniApp: {
    capabilities: string[];
    defaultMode: "inline" | "compact" | "fullscreen";
    entryPoint: string;
    launchModes: Array<"inline" | "compact" | "fullscreen">;
    url?: string;
  };
  name: string;
  permissions?: TeleforgePermission[];
  routes: RouteDefinition[];
  runtime: TeleforgeRuntime;
  security?: {
    allowedOrigins?: string[];
    validateInitData?: boolean;
    webhookSecret?: string;
  };
  version: string;
}
