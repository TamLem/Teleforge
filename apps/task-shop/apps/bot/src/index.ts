import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { startTeleforgeBot, startTeleforgeServer, createTeleforgeRuntimeContext } from "teleforge";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const context = await createTeleforgeRuntimeContext({ cwd: projectRoot });

const { runtime, stop: stopBot } = await startTeleforgeBot({
  app: context.app,
  cwd: projectRoot,
  flowSecret: context.flowSecret,
  miniAppUrl: context.miniAppUrl,
  sessionManager: context.sessionManager,
  token: context.token
});

console.log(`[bot] GadgetShop bot running (${runtime.getCommands().length} commands)`);

const { url, stop: stopServer } = await startTeleforgeServer({
  cwd: projectRoot,
  flowSecret: context.flowSecret,
  port: context.app.runtime.server?.port ?? 3100,
  sessionManager: context.sessionManager,
  onChatHandoff: async ({ context: ctx, message, replyMarkup }) => {
    console.log("[bot] sending chat message to", ctx.userId);
    await runtime.handleChatHandoff({ context: ctx, message, replyMarkup });
  }
});

console.log(`[bot] action server listening at ${url}`);

const shutdown = () => {
  console.log("\n[bot] shutting down...");
  stopServer();
  stopBot();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
