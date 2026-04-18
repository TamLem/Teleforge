import { stat } from "node:fs/promises";
import path from "node:path";

import qrcodeTerminal from "qrcode-terminal";

import { createDevSimulator } from "../utils/dev-simulator.js";
import { loadManifest } from "../utils/manifest.js";
import { injectTelegramMock } from "../utils/mock.js";
import { openBrowser } from "../utils/open.js";
import { runManagedDevCommand, type SharedCommandFlags } from "../utils/server.js";
import { type TunnelProvider } from "../utils/tunnel.js";
import { configureTelegramWebhook } from "../utils/webhook.js";

export interface DevCommandFlags extends SharedCommandFlags {
  autoloadApp: boolean;
  mock: boolean;
  open: boolean;
  qr: boolean;
  subdomain?: string;
  tunnelProvider: TunnelProvider;
  webhook: boolean;
}

/**
 * Starts the primary Teleforge development workflow, including environment checks and optional
 * HTTPS support when requested through the shared command flags.
 */
export async function runDevCommand(flags: DevCommandFlags): Promise<void> {
  let browserOpened = false;
  const loadedState = flags.mock || flags.webhook ? await loadManifest(flags.cwd) : undefined;
  const loadedManifest = loadedState?.manifest;
  const manifest = flags.webhook ? loadedManifest : undefined;
  const webhookSupport =
    flags.webhook && manifest
      ? await resolveWebhookSupport(flags.cwd, manifest.runtime.webFramework)
      : undefined;
  const simulator =
    flags.mock && loadedManifest
      ? createDevSimulator({
          autoloadApp: flags.autoloadApp,
          cwd: flags.cwd,
          discoveredFlows: loadedState?.discoveredFlows ?? [],
          env: process.env,
          manifest: loadedManifest
        })
      : undefined;

  if (flags.webhook && (!flags.tunnel || !flags.https)) {
    throw new Error(
      "`teleforge dev --webhook` requires `--public` or explicit `--https --tunnel`."
    );
  }

  if (flags.webhook && !webhookSupport?.supported) {
    throw new Error(webhookSupport?.message ?? "Webhook mode is not supported by this workspace.");
  }

  try {
    await runManagedDevCommand({
      defaultPort: 3000,
      flags,
      htmlTransformer:
        flags.mock && simulator
          ? (html, requestPath) =>
              injectTelegramMock(html, {
                overlay: false,
                profile:
                  simulator.appBasePath && requestPath.startsWith(simulator.appBasePath)
                    ? simulator.getCurrentProfile()
                    : undefined
              })
          : flags.mock
            ? (html) => injectTelegramMock(html)
            : undefined,
      onStarted: async (context) => {
        console.log(
          `✓ Validated Teleforge app config (${context.manifest.runtime.mode.toUpperCase()} mode, ${context.manifest.runtime.webFramework})`
        );
        console.log("✓ Project environment loaded");

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

        console.log(
          `✓ ${flags.mock ? "Simulator shell" : `${context.frameworkLabel} dev server`} running on ${context.url}`
        );

        if (flags.mock) {
          console.log("✓ Telegram simulator shell active");
        }

        if (context.companionServices.length > 0) {
          console.log(`✓ Companion services active: ${context.companionServices.join(", ")}`);
        }

        if (context.tunnelUrl) {
          console.log(`✓ Public tunnel active: ${context.tunnelUrl}`);
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
            console.log(
              "Warning: Tunnel is unavailable, so webhook auto-configuration was skipped."
            );
          }
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

        console.log("");
        if (context.tunnelWarning) {
          console.log(`Warning: ${context.tunnelWarning}`);
        }
      },
      proxyMountPath: simulator?.appBasePath,
      requestHandler: simulator
        ? (request, response) => {
            return simulator.handleRequest(request, response);
          }
        : undefined,
      requiredEnv: [],
      subdomain: flags.subdomain,
      tunnelProvider: flags.tunnelProvider
    });
  } finally {
    await simulator?.cleanup();
  }
}

interface WebhookSupportResult {
  message?: string;
  supported: boolean;
}

async function resolveWebhookSupport(
  cwd: string,
  webFramework: "vite" | "nextjs" | "custom"
): Promise<WebhookSupportResult> {
  if (webFramework !== "nextjs") {
    return {
      message:
        "Webhook mode currently requires a Next.js/BFF web runtime that serves /api/webhook through apps/web.",
      supported: false
    };
  }

  const webDirectory = path.join(cwd, "apps", "web");
  const routeCandidates = [
    path.join(webDirectory, "app", "api", "webhook", "route.ts"),
    path.join(webDirectory, "app", "api", "webhook", "route.tsx"),
    path.join(webDirectory, "app", "api", "webhook", "route.js"),
    path.join(webDirectory, "app", "api", "webhook", "route.mjs"),
    path.join(webDirectory, "pages", "api", "webhook.ts"),
    path.join(webDirectory, "pages", "api", "webhook.tsx"),
    path.join(webDirectory, "pages", "api", "webhook.js"),
    path.join(webDirectory, "pages", "api", "webhook.mjs")
  ];

  try {
    const webStats = await stat(webDirectory);
    if (!webStats.isDirectory()) {
      return {
        message: "Webhook mode requires an apps/web workspace with a runnable /api/webhook route.",
        supported: false
      };
    }
  } catch {
    return {
      message: "Webhook mode requires an apps/web workspace with a runnable /api/webhook route.",
      supported: false
    };
  }

  for (const candidate of routeCandidates) {
    try {
      const routeStats = await stat(candidate);
      if (routeStats.isFile()) {
        return { supported: true };
      }
    } catch {
      continue;
    }
  }

  return {
    message:
      "Webhook mode requires apps/web/app/api/webhook/route.* or apps/web/pages/api/webhook.* before enabling --webhook.",
    supported: false
  };
}
