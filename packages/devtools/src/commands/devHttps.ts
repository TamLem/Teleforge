import qrcodeTerminal from "qrcode-terminal";

import { injectTelegramMock } from "../utils/mock.js";
import { runManagedDevCommand, type SharedCommandFlags } from "../utils/server.js";
import { type TunnelProvider } from "../utils/tunnel.js";
import { configureTelegramWebhook } from "../utils/webhook.js";

export interface DevHttpsCommandFlags extends SharedCommandFlags {
  mock: boolean;
  qr: boolean;
  subdomain?: string;
  tunnelProvider: TunnelProvider;
  webhook: boolean;
}

export async function runDevHttpsCommand(flags: DevHttpsCommandFlags): Promise<void> {
  await runManagedDevCommand({
    defaultPort: 3443,
    flags: {
      ...flags,
      https: true
    },
    htmlTransformer: flags.mock ? injectTelegramMock : undefined,
    onStarted: async (context) => {
      console.log(
        `✓ Validated teleforge.app.json (${context.manifest.runtime.mode.toUpperCase()} mode, ${context.manifest.runtime.webFramework})`
      );
      console.log("✓ HTTPS certificates ready (.teleforge/certs)");

      if (context.externalPort !== context.requestedPort) {
        console.log(
          `✓ Port ${context.requestedPort} unavailable, using ${context.externalPort} instead`
        );
      }

      console.log(`✓ ${context.frameworkLabel} dev server running on ${context.url}`);

      if (context.tunnelUrl) {
        console.log(`✓ Public tunnel active: ${context.tunnelUrl}`);
      }

      if (context.tunnelWarning) {
        console.log(`Warning: ${context.tunnelWarning}`);
      }

      if (flags.mock) {
        console.log("✓ Telegram WebApp mock overlay injected");
      }

      if (context.companionServices.length > 0) {
        console.log(`✓ Companion services active: ${context.companionServices.join(", ")}`);
      }

      if (flags.qr) {
        const qrTarget = context.tunnelUrl ?? context.url;
        console.log("");
        console.log("Scan with Telegram mobile to test:");
        qrcodeTerminal.generate(qrTarget, { small: true });
        console.log(qrTarget);
      }

      if (flags.webhook) {
        if (context.tunnelUrl) {
          const result = await configureTelegramWebhook({
            env: context.env,
            manifest: context.manifest,
            tunnelUrl: context.tunnelUrl
          });
          console.log(
            result.status === "configured" ? `✓ ${result.message}` : `Warning: ${result.message}`
          );
          if (result.warning) {
            console.log(`Warning: ${result.warning}`);
          }
        } else {
          console.log("Warning: Tunnel is unavailable, so webhook auto-configuration was skipped.");
        }
      }

      console.log("");
      console.log("Ready for Telegram Mini App HTTPS development!");
    },
    requiredEnv: [],
    subdomain: flags.subdomain,
    tunnelProvider: flags.tunnelProvider
  });
}
