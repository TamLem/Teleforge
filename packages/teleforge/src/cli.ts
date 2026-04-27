import process from "node:process";

import {
  createTeleforgeRuntimeContext,
  createTeleforgeWebhookHandler,
  startTeleforgeBot,
  startTeleforgeServer
} from "./index.js";

async function runStartCommand(): Promise<void> {
  const cwd = process.cwd();

  const context = await createTeleforgeRuntimeContext({ cwd });
  const delivery = context.app.runtime.bot?.delivery ?? "polling";
  const needsServer = Boolean(context.app.miniApp) || delivery === "webhook";

  const { runtime: botRuntime, stop: stopBot } = await startTeleforgeBot({
    app: context.app,
    cwd,
    flowSecret: context.flowSecret,
    miniAppUrl: context.miniAppUrl,
    phoneAuthSecret: context.phoneAuthSecret,
    services: context.services,
    sessionManager: context.sessionManager,
    token: context.token
  });

  let stopServer: (() => void) | undefined;

  if (needsServer) {
    const additionalRoutes: NonNullable<Parameters<typeof startTeleforgeServer>[0]>["additionalRoutes"] = [];

    if (delivery === "webhook") {
      const webhookPath = context.app.bot.webhook?.path;

      if (webhookPath) {
        additionalRoutes!.push({
          handler: await createTeleforgeWebhookHandler({
            app: context.app,
            cwd,
            flowSecret: context.flowSecret,
            miniAppUrl: context.miniAppUrl,
            phoneAuthSecret: context.phoneAuthSecret,
            services: context.services,
            sessionManager: context.sessionManager
          }),
          path: webhookPath
        });
        console.log(`[teleforge:start] webhook endpoint mounted at ${webhookPath}`);
      }
    }

    const server = await startTeleforgeServer({
      additionalRoutes,
      flowSecret: context.flowSecret,
      onChatHandoff: (input) => {
        botRuntime.handleChatHandoff({ context: input.context, message: input.message });
      },
      port: context.app.runtime.server?.port,
      services: context.services,
      sessionManager: context.sessionManager
    });

    stopServer = server.stop;
    console.log(`[teleforge:start] action server running at ${server.url}`);
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

  await new Promise(() => {});
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "start") {
    await runStartCommand();
    return;
  }

  // @ts-ignore — devtools/cli has no types
  await import("@teleforgex/devtools/cli");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
