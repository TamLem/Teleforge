import { createBotRuntime } from "@teleforgex/bot";
import { UserFlowStateManager, createFlowStorage } from "@teleforgex/core";

import { loadTeleforgeApp } from "./config.js";
import { createFlowCommands, loadTeleforgeFlows } from "./discovery.js";

import type { BotRuntime } from "@teleforgex/bot";
import type { TeleforgeAppConfig } from "@teleforgex/core";
import type { CreateFlowCommandsOptions } from "./discovery.js";

export interface CreateDiscoveredBotRuntimeOptions {
  app?: TeleforgeAppConfig;
  commandOptions?: Omit<CreateFlowCommandsOptions, "flows" | "secret" | "storage" | "webAppUrl">;
  cwd?: string;
  flowSecret: string;
  miniAppUrl: string;
  storage?: UserFlowStateManager;
  storageTtlSeconds?: number;
}

export async function createDiscoveredBotRuntime(
  options: CreateDiscoveredBotRuntimeOptions
): Promise<BotRuntime> {
  const cwd = options.cwd ?? process.cwd();
  const app = options.app ?? (await loadTeleforgeApp(cwd)).app;
  const flows = await loadTeleforgeFlows({
    app,
    cwd
  });
  const runtime = createBotRuntime();
  const storage =
    options.storage ??
    new UserFlowStateManager(
      createFlowStorage({
        backend: "memory",
        defaultTTL: options.storageTtlSeconds ?? 900,
        namespace: app.app.id
      })
    );

  runtime.registerCommands(
    createFlowCommands({
      ...(options.commandOptions ?? {}),
      flows,
      secret: options.flowSecret,
      storage,
      webAppUrl: options.miniAppUrl
    })
  );

  return runtime;
}
