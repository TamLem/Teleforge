import type {
  RouteDefinition,
  TeleforgeManifest,
  TeleforgePermission,
  TeleforgeRuntime
} from "../manifest/types.js";

export interface TeleforgeAppIdentity {
  id: string;
  name: string;
  version: string;
}

export interface TeleforgeMiniAppConfig extends Omit<TeleforgeManifest["miniApp"], "entryPoint"> {
  entry: string;
}

export interface TeleforgeFlowConventions {
  root?: string;
}

export interface TeleforgeAppConfig {
  app: TeleforgeAppIdentity;
  bot: TeleforgeManifest["bot"];
  build?: TeleforgeManifest["build"];
  dev?: TeleforgeManifest["dev"];
  features?: TeleforgeManifest["features"];
  flows?: TeleforgeFlowConventions;
  miniApp: TeleforgeMiniAppConfig;
  permissions?: TeleforgePermission[];
  routes: RouteDefinition[];
  runtime: TeleforgeRuntime;
  security?: TeleforgeManifest["security"];
}

export function defineTeleforgeApp<TConfig extends TeleforgeAppConfig>(config: TConfig): TConfig {
  return Object.freeze(config);
}

export function teleforgeAppToManifest(config: TeleforgeAppConfig): TeleforgeManifest {
  const { entry, ...miniApp } = config.miniApp;

  return {
    bot: config.bot,
    ...(config.build ? { build: config.build } : {}),
    ...(config.dev ? { dev: config.dev } : {}),
    ...(config.features ? { features: config.features } : {}),
    id: config.app.id,
    miniApp: {
      ...miniApp,
      entryPoint: entry
    },
    name: config.app.name,
    ...(config.permissions ? { permissions: config.permissions } : {}),
    routes: config.routes,
    runtime: config.runtime,
    ...(config.security ? { security: config.security } : {}),
    version: config.app.version
  };
}
