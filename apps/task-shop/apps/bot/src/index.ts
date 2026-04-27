import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { startTeleforgeBot, createTeleforgeRuntimeContext } from "teleforge";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const context = await createTeleforgeRuntimeContext({ cwd: projectRoot });

const { runtime: _runtime, stop } = await startTeleforgeBot({
  app: context.app,
  cwd: projectRoot,
  flowSecret: context.flowSecret,
  miniAppUrl: context.miniAppUrl,
  sessionManager: context.sessionManager
});

console.log("[bot] GadgetShop bot running");

process.on("SIGINT", () => { stop(); process.exit(0); });
process.on("SIGTERM", () => { stop(); process.exit(0); });
