import { runManagedDevCommand, type SharedCommandFlags } from "../utils/server.js";

export interface DevCommandFlags extends SharedCommandFlags {}

export async function runDevCommand(flags: DevCommandFlags): Promise<void> {
  await runManagedDevCommand({
    defaultPort: 3000,
    flags,
    onStarted(context) {
      console.log(
        `✓ Validated teleforge.app.json (${context.manifest.runtime.mode.toUpperCase()} mode, ${context.manifest.runtime.webFramework})`
      );
      console.log("✓ Environment check passed (BOT_TOKEN, WEBHOOK_SECRET)");

      if (flags.https) {
        console.log("✓ HTTPS certificates ready (.teleforge/certs)");
      }

      if (context.externalPort !== context.requestedPort) {
        console.log(`✓ Port ${context.requestedPort} unavailable, using ${context.externalPort} instead`);
      }

      console.log(`✓ ${context.frameworkLabel} dev server running on ${context.url}`);
      console.log("");
      console.log("Ready for Telegram Mini App development!");

      if (context.tunnelUrl) {
        console.log("");
        console.log(`Webhook tunnel active: ${context.tunnelUrl}/api/webhook`);
      }

      if (context.tunnelWarning) {
        console.log("");
        console.log(`Warning: ${context.tunnelWarning}`);
      }
    },
    requiredEnv: ["BOT_TOKEN", "WEBHOOK_SECRET"]
  });
}
