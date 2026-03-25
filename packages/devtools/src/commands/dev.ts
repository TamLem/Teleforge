import { injectTelegramMock } from "../utils/mock.js";
import { openBrowser } from "../utils/open.js";
import { runManagedDevCommand, type SharedCommandFlags } from "../utils/server.js";

export interface DevCommandFlags extends SharedCommandFlags {
  mock: boolean;
  open: boolean;
}

/**
 * Starts the primary Teleforge development workflow, including environment checks and optional
 * HTTPS support when requested through the shared command flags.
 */
export async function runDevCommand(flags: DevCommandFlags): Promise<void> {
  let browserOpened = false;

  await runManagedDevCommand({
    defaultPort: 3000,
    flags,
    htmlTransformer: flags.mock ? injectTelegramMock : undefined,
    onStarted(context) {
      console.log(
        `✓ Validated teleforge.app.json (${context.manifest.runtime.mode.toUpperCase()} mode, ${context.manifest.runtime.webFramework})`
      );
      console.log("✓ Environment check passed (BOT_TOKEN, WEBHOOK_SECRET)");

      if (context.loadedEnvFiles.includes(".env.local")) {
        console.log("✓ Loaded env overrides from .env.local");
      }

      if (flags.https) {
        console.log("✓ HTTPS certificates ready (.teleforge/certs)");
      }

      if (context.externalPort !== context.requestedPort) {
        console.log(
          `✓ Port ${context.requestedPort} unavailable, using ${context.externalPort} instead`
        );
      }

      console.log(`✓ ${context.frameworkLabel} dev server running on ${context.url}`);

      if (flags.mock) {
        console.log("✓ Telegram WebApp mock overlay injected");
      }

      if (flags.open && !browserOpened) {
        browserOpened = true;
        void openBrowser(context.url)
          .then(() => {
            console.log(`✓ Opened ${context.url} in your browser`);
          })
          .catch((error) => {
            console.log(
              `Warning: Could not open browser automatically (${error instanceof Error ? error.message : "unknown error"}).`
            );
          });
      }

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
