import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { startTeleforgeServer, createTeleforgeRuntimeContext } from "teleforge";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const context = await createTeleforgeRuntimeContext({ cwd: projectRoot });

const { url, stop } = await startTeleforgeServer({
  cwd: projectRoot,
  flowSecret: context.flowSecret,
  port: context.app.runtime.server?.port ?? 3100,
  sessionManager: context.sessionManager
});

console.log(`[api] GadgetShop action server listening at ${url}`);

process.on("SIGINT", () => { stop(); process.exit(0); });
process.on("SIGTERM", () => { stop(); process.exit(0); });
