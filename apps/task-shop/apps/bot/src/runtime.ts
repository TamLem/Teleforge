import path from "node:path";
import { fileURLToPath } from "node:url";

import { startTeleforgeBot } from "teleforge";

import type { BotRuntime } from "teleforge/bot";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export async function createDevBotRuntime(): Promise<BotRuntime> {
  const { runtime } = await startTeleforgeBot({ cwd: projectRoot });
  return runtime;
}
