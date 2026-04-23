import process from "node:process";

import {
  loadTeleforgeApp,
  loadTeleforgeFlowServerHooks,
  startTeleforgeBot,
  startTeleforgeServer
} from "./index.js";

async function runStartCommand(): Promise<void> {
  const cwd = process.cwd();

  // Load config once and pass it to boot functions so they do not reload it.
  const { app } = await loadTeleforgeApp(cwd);

  // Discover server hooks once so the CLI decides whether to start the server.
  const serverHooks = await loadTeleforgeFlowServerHooks({ app, cwd });
  const hasServerHooks = serverHooks.length > 0;

  const { runtime: botRuntime, stop: stopBot } = await startTeleforgeBot({ app, cwd });

  let stopServer: (() => void) | undefined;

  if (hasServerHooks) {
    const server = await startTeleforgeServer({
      app,
      cwd,
      onChatHandoff: (input) => botRuntime.handleChatHandoff(input),
      storage: botRuntime.getStorage()
    });
    stopServer = server.stop;
    console.log(
      `[teleforge:start] server hooks running at ${server.url} (${serverHooks.length} hook(s) loaded)`
    );
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
