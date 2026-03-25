import { X509Certificate } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { loadProjectEnv } from "../env.js";
import { loadManifest, type TeleforgeManifest } from "../manifest.js";

import { applyDoctorFixes, type DoctorFix } from "./fixes.js";

export type DoctorCheckStatus = "pass" | "warn" | "error";

export interface DoctorCheck {
  category: "Environment" | "Configuration" | "Connectivity" | "BotFather";
  details?: string[];
  message: string;
  name: string;
  remediation?: string;
  status: DoctorCheckStatus;
}

export interface DoctorRunResult {
  checks: DoctorCheck[];
  cwd: string;
  fixes: DoctorFix[];
  status: DoctorCheckStatus;
  summary: {
    error: number;
    pass: number;
    warn: number;
  };
}

export interface RunDoctorChecksOptions {
  cwd: string;
  fetchImpl?: typeof fetch;
  fix: boolean;
}

interface ManifestState {
  error?: string;
  manifest?: TeleforgeManifest;
  manifestPath: string;
}

export async function runDoctorChecks(options: RunDoctorChecksOptions): Promise<DoctorRunResult> {
  const fixes = options.fix ? await applyDoctorFixes(options.cwd) : [];
  const env = await loadProjectEnv(options.cwd);
  const manifestState = await loadManifestState(options.cwd);
  const checks: DoctorCheck[] = [];
  const publicUrl = resolvePublicUrl(env, manifestState.manifest);

  checks.push(await checkEnvFile(options.cwd, fixes));
  checks.push(await checkManifestConsistency(options.cwd, manifestState));
  checks.push(checkBotToken(env, manifestState.manifest));
  checks.push(checkWebhookSecret(env, manifestState.manifest));
  checks.push(checkMiniAppUrl(publicUrl));
  checks.push(await checkHttpsAvailability(options.cwd));
  checks.push(
    await checkWebhookReachability({
      env,
      fetchImpl: options.fetchImpl ?? fetch,
      manifest: manifestState.manifest,
      publicUrl
    })
  );
  checks.push(checkBotFatherSetup(publicUrl, manifestState.manifest));

  const summary = checks.reduce(
    (accumulator, check) => {
      accumulator[check.status] += 1;
      return accumulator;
    },
    { error: 0, pass: 0, warn: 0 }
  );

  return {
    checks,
    cwd: options.cwd,
    fixes,
    status: summary.error > 0 ? "error" : summary.warn > 0 ? "warn" : "pass",
    summary
  };
}

async function loadManifestState(cwd: string): Promise<ManifestState> {
  const manifestPath = path.join(cwd, "teleforge.app.json");

  try {
    const { manifest } = await loadManifest(cwd);
    return {
      manifest,
      manifestPath
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      manifestPath
    };
  }
}

async function checkEnvFile(cwd: string, fixes: DoctorFix[]): Promise<DoctorCheck> {
  const envPath = path.join(cwd, ".env");
  const envExamplePath = path.join(cwd, ".env.example");
  const envExists = await pathExists(envPath);
  const envExampleExists = await pathExists(envExamplePath);
  const createdFix = fixes.find((fix) => fix.name === "create_env_file" && fix.applied);

  if (envExists) {
    return {
      category: "Environment",
      message: createdFix ? ".env created from .env.example." : ".env file present.",
      name: "env_file",
      status: "pass"
    };
  }

  return {
    category: "Environment",
    details: envExampleExists ? [".env.example is available for bootstrapping."] : undefined,
    message: ".env file is missing.",
    name: "env_file",
    remediation: envExampleExists
      ? "Run `teleforge doctor --fix` to create .env from .env.example."
      : "Create a .env file with your bot and webhook settings.",
    status: "warn"
  };
}

async function checkManifestConsistency(
  cwd: string,
  manifestState: ManifestState
): Promise<DoctorCheck> {
  if (!manifestState.manifest) {
    return {
      category: "Configuration",
      details: manifestState.error ? [manifestState.error] : undefined,
      message: "teleforge.app.json is missing or invalid.",
      name: "manifest_consistency",
      remediation: "Create or repair teleforge.app.json before running Teleforge commands.",
      status: "error"
    };
  }

  const manifest = manifestState.manifest;
  const issues: string[] = [];

  if (!manifest.id) {
    issues.push("Manifest is missing `id`.");
  }

  if (!manifest.name) {
    issues.push("Manifest is missing `name`.");
  }

  if (!manifest.version) {
    issues.push("Manifest is missing `version`.");
  }

  if (!manifest.bot?.tokenEnv) {
    issues.push("Manifest is missing `bot.tokenEnv`.");
  }

  if (!manifest.bot?.webhook?.path) {
    issues.push("Manifest is missing `bot.webhook.path`.");
  }

  if (!manifest.miniApp?.entryPoint) {
    issues.push("Manifest is missing `miniApp.entryPoint`.");
  } else if (!(await pathExists(path.resolve(cwd, manifest.miniApp.entryPoint)))) {
    issues.push(`Mini App entry point not found: ${manifest.miniApp.entryPoint}`);
  }

  if (!manifest.routes || manifest.routes.length === 0) {
    issues.push("Manifest does not declare any routes.");
  } else {
    for (const route of manifest.routes) {
      if (!route.path?.startsWith("/")) {
        issues.push(`Route path must start with "/": ${route.path ?? "(missing path)"}`);
      }

      if (!route.component) {
        issues.push(`Route ${route.path ?? "(unknown)"} is missing a component.`);
        continue;
      }

      const componentPath = await resolveRouteComponent(cwd, route.component);
      if (!componentPath) {
        issues.push(
          `Route component not found for ${route.path ?? route.component}: ${route.component}`
        );
      }
    }
  }

  if (manifest.runtime.mode === "bff" && manifest.runtime.apiRoutes) {
    const apiRoutesPath = path.resolve(cwd, manifest.runtime.apiRoutes);
    if (!(await pathExists(apiRoutesPath))) {
      issues.push(`Runtime API routes directory not found: ${manifest.runtime.apiRoutes}`);
    }
  }

  if (issues.length > 0) {
    return {
      category: "Configuration",
      details: issues,
      message: "Manifest consistency checks failed.",
      name: "manifest_consistency",
      remediation: "Repair teleforge.app.json and the referenced files before retrying.",
      status: "error"
    };
  }

  return {
    category: "Configuration",
    message: "Manifest fields and referenced project files look consistent.",
    name: "manifest_consistency",
    status: "pass"
  };
}

function checkBotToken(
  env: NodeJS.ProcessEnv,
  manifest: TeleforgeManifest | undefined
): DoctorCheck {
  const tokenEnv = manifest?.bot?.tokenEnv ?? "BOT_TOKEN";
  const token = env[tokenEnv];

  if (hasRealValue(token)) {
    return {
      category: "Environment",
      message: `${tokenEnv} configured.`,
      name: "bot_token",
      status: "pass"
    };
  }

  return {
    category: "Environment",
    message: `${tokenEnv} is missing or still uses a placeholder value.`,
    name: "bot_token",
    remediation: `Set ${tokenEnv} in .env or the shell environment with a real Telegram bot token.`,
    status: "error"
  };
}

function checkWebhookSecret(
  env: NodeJS.ProcessEnv,
  manifest: TeleforgeManifest | undefined
): DoctorCheck {
  const secretEnv = manifest?.bot?.webhook?.secretEnv;

  if (!secretEnv) {
    return {
      category: "Environment",
      message: "Webhook secret is not configured in the manifest.",
      name: "webhook_secret",
      remediation:
        "Add bot.webhook.secretEnv if you want doctor to validate webhook secret configuration.",
      status: "warn"
    };
  }

  const value = env[secretEnv];
  if (hasRealValue(value)) {
    return {
      category: "Environment",
      message: `${secretEnv} configured.`,
      name: "webhook_secret",
      status: "pass"
    };
  }

  return {
    category: "Environment",
    message: `${secretEnv} is missing or still uses a placeholder value.`,
    name: "webhook_secret",
    remediation: `Set ${secretEnv} in .env or the shell environment.`,
    status: "warn"
  };
}

function checkMiniAppUrl(publicUrl: string | undefined): DoctorCheck {
  if (!publicUrl) {
    return {
      category: "Configuration",
      details: ["No TELEFORGE_PUBLIC_URL env var or manifest.miniApp.url was found."],
      message: "Mini App URL not configured.",
      name: "mini_app_url",
      remediation:
        "Set TELEFORGE_PUBLIC_URL=https://your-domain.com or add miniApp.url to teleforge.app.json.",
      status: "warn"
    };
  }

  try {
    const url = new URL(publicUrl);
    if (url.protocol !== "https:") {
      return {
        category: "Configuration",
        message: `Mini App URL must use HTTPS: ${publicUrl}`,
        name: "mini_app_url",
        remediation: "Use an https:// URL for Telegram Mini App launches.",
        status: "error"
      };
    }

    return {
      category: "Configuration",
      message: `Mini App URL valid (${url.origin}).`,
      name: "mini_app_url",
      status: "pass"
    };
  } catch {
    return {
      category: "Configuration",
      message: `Mini App URL is invalid: ${publicUrl}`,
      name: "mini_app_url",
      remediation: "Set TELEFORGE_PUBLIC_URL to a valid https:// URL.",
      status: "error"
    };
  }
}

async function checkHttpsAvailability(cwd: string): Promise<DoctorCheck> {
  const certPath = path.join(cwd, ".teleforge", "certs", "localhost-cert.pem");
  const keyPath = path.join(cwd, ".teleforge", "certs", "localhost-key.pem");

  if (!(await pathExists(certPath)) || !(await pathExists(keyPath))) {
    return {
      category: "Connectivity",
      message: "Local HTTPS certificates have not been generated yet.",
      name: "https_availability",
      remediation: "Run `teleforge dev:https` once to generate local development certificates.",
      status: "warn"
    };
  }

  try {
    const certificate = new X509Certificate(await readFile(certPath, "utf8"));
    return {
      category: "Connectivity",
      details: [`Certificate valid until ${certificate.validTo}.`],
      message: "Local HTTPS certificates are present.",
      name: "https_availability",
      status: "pass"
    };
  } catch (error) {
    return {
      category: "Connectivity",
      details: [error instanceof Error ? error.message : String(error)],
      message: "Local HTTPS certificate could not be parsed.",
      name: "https_availability",
      remediation:
        "Delete the local cert files and rerun `teleforge dev:https` to regenerate them.",
      status: "error"
    };
  }
}

async function checkWebhookReachability(options: {
  env: NodeJS.ProcessEnv;
  fetchImpl: typeof fetch;
  manifest: TeleforgeManifest | undefined;
  publicUrl?: string;
}): Promise<DoctorCheck> {
  const webhookPath = options.manifest?.bot?.webhook?.path;

  if (!webhookPath) {
    return {
      category: "Connectivity",
      message: "Webhook path is not configured in the manifest.",
      name: "webhook_reachable",
      remediation: "Add bot.webhook.path to teleforge.app.json.",
      status: "error"
    };
  }

  const localDevPort = resolveLocalDevPort(options.env.TELEFORGE_DEV_PORT);
  const localDevScheme = isTruthy(options.env.TELEFORGE_DEV_HTTPS) ? "https" : "http";
  const baseUrl = options.publicUrl ?? `${localDevScheme}://127.0.0.1:${localDevPort}`;
  const targetUrl = new URL(webhookPath, ensureTrailingSlash(baseUrl)).toString();

  try {
    const response = await options.fetchImpl(targetUrl, {
      body: JSON.stringify({
        source: "teleforge-doctor",
        type: "ping"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST",
      signal: AbortSignal.timeout(3_000)
    });

    if (!response.ok) {
      return {
        category: "Connectivity",
        details: [`Target: ${targetUrl}`, `Response: ${response.status} ${response.statusText}`],
        message: "Webhook endpoint responded with a non-success status.",
        name: "webhook_reachable",
        remediation: "Start the dev server or repair the webhook handler before retrying.",
        status: "error"
      };
    }

    return {
      category: "Connectivity",
      details: options.publicUrl
        ? [`Target: ${targetUrl}`]
        : [
            `Target: ${targetUrl}`,
            "Local reachability passed, but Telegram still requires a public HTTPS URL."
          ],
      message: `Webhook reachable (${response.status}).`,
      name: "webhook_reachable",
      status: "pass"
    };
  } catch (error) {
    return {
      category: "Connectivity",
      details: [`Target: ${targetUrl}`],
      message: `Webhook not reachable: ${formatErrorMessage(error)}`,
      name: "webhook_reachable",
      remediation: options.publicUrl
        ? "Verify that the deployed webhook endpoint is online and accepts POST requests."
        : "Start the dev server with `teleforge dev` or `teleforge dev:https`, or set TELEFORGE_PUBLIC_URL to a reachable deployment.",
      status: "error"
    };
  }
}

function checkBotFatherSetup(
  publicUrl: string | undefined,
  manifest: TeleforgeManifest | undefined
): DoctorCheck {
  const username = manifest?.bot?.username;

  if (!publicUrl) {
    return {
      category: "BotFather",
      details: ["Cannot verify /setmenubutton or /setwebhook readiness without a public URL."],
      message: "BotFather Mini App URL not verified.",
      name: "botfather",
      remediation:
        "Use `teleforge dev:https --tunnel` or deploy the app, then configure BotFather menu button settings.",
      status: "warn"
    };
  }

  if (!username) {
    return {
      category: "BotFather",
      message: "Bot username missing from the manifest.",
      name: "botfather",
      remediation: "Set bot.username in teleforge.app.json before configuring BotFather.",
      status: "warn"
    };
  }

  return {
    category: "BotFather",
    details: [`Bot username: @${username}`, `Menu button URL candidate: ${publicUrl}`],
    message: "BotFather inputs are present for manual menu button configuration.",
    name: "botfather",
    status: "pass"
  };
}

function resolvePublicUrl(
  env: NodeJS.ProcessEnv,
  manifest: TeleforgeManifest | undefined
): string | undefined {
  const explicit = trimToUndefined(env.TELEFORGE_PUBLIC_URL);
  if (explicit) {
    return trimTrailingSlash(explicit);
  }

  const manifestUrl = trimToUndefined(manifest?.miniApp?.url);
  if (manifestUrl) {
    return trimTrailingSlash(manifestUrl);
  }

  return undefined;
}

async function resolveRouteComponent(cwd: string, component: string): Promise<string | undefined> {
  const basePath = path.resolve(cwd, "apps", "web", "src", component);
  const candidates = [
    `${basePath}.tsx`,
    `${basePath}.ts`,
    `${basePath}.jsx`,
    `${basePath}.js`,
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.jsx"),
    path.join(basePath, "index.js")
  ];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function trimToUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function hasRealValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0 && !isPlaceholder(value);
}

function isPlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes("your_") ||
    normalized.includes("example") ||
    normalized.includes("placeholder") ||
    normalized.endsWith("_here")
  );
}

function resolveLocalDevPort(value: string | undefined): number {
  if (!value) {
    return 3000;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3000;
}

function isTruthy(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
