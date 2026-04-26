import process from "node:process";

import {
  createTeleforgeRuntimeContext,
  createTeleforgeWebhookHandler,
  loadTeleforgeFlowServerHooks,
  startTeleforgeBot,
  startTeleforgeServer
} from "./index.js";

async function runStartCommand(): Promise<void> {
  const cwd = process.cwd();

  // Resolve a shared runtime context once: config, secrets, storage.
  // Both bot and server bootstraps reuse this so initialization is not duplicated.
  const context = await createTeleforgeRuntimeContext({ cwd });
  const delivery = context.app.runtime.bot?.delivery ?? "polling";

  // Discover server hooks once so the CLI decides whether to start the server.
  const serverHooks = await loadTeleforgeFlowServerHooks({ app: context.app, cwd });
  const hasServerHooks = serverHooks.length > 0;
  const needsServer = Boolean(context.app.miniApp) || hasServerHooks || delivery === "webhook";

  const { runtime: botRuntime, stop: stopBot } = await startTeleforgeBot({ context });

  let stopServer: (() => void) | undefined;

  if (needsServer) {
    // In webhook mode, mount the Telegram webhook handler on the hooks server
    // at the configured webhook path alongside any flow-hooks routes.
    const additionalRoutes: NonNullable<Parameters<typeof startTeleforgeServer>[0]>["additionalRoutes"] = [];

    if (delivery === "webhook") {
      const webhookPath = context.app.bot.webhook?.path;
      const webhookSecretEnv = context.app.bot.webhook?.secretEnv;
      const webhookSecret = webhookSecretEnv ? process.env[webhookSecretEnv]?.trim() : undefined;

      if (webhookPath) {
        const webhookHandler = createTeleforgeWebhookHandler(botRuntime, {
          secretToken: webhookSecret
        });
        additionalRoutes!.push({ handler: webhookHandler, path: webhookPath });
        console.log(`[teleforge:start] webhook endpoint mounted at ${webhookPath}`);
      }
    }

    const server = await startTeleforgeServer({
      additionalRoutes,
      context,
      onChatHandoff: (input) => botRuntime.handleChatHandoff(input)
    });
    stopServer = server.stop;

    if (hasServerHooks) {
      console.log(
        `[teleforge:start] server hooks running at ${server.url} (${serverHooks.length} hook(s) loaded)`
      );
    } else {
      console.log(`[teleforge:start] server bridge running at ${server.url}`);
    }
  }

  console.log(
    `[teleforge:start] bot running (${botRuntime.getCommands().length} command(s) registered)`
  );

  const shutdown = () => {
    console.log("\n[teleforge:start] shutting down...");
    stopBot();
    stopServer?.();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep the process alive until a signal arrives
  await new Promise(() => {});
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "start") {
    await runStartCommand();
    return;
  }

  // Delegate all other commands to the devtools CLI
  // @ts-ignore — devtools/cli is a side-effectful script entry without typings.
  await import("@teleforgex/devtools/cli");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
