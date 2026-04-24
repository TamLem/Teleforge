import { execFile } from "node:child_process";
import { X509Certificate } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { checkClientManifestDrift } from "../client-manifest-drift.js";
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
  execFileImpl?: ExecFileImpl;
  fetchImpl?: typeof fetch;
  fix: boolean;
  nodeVersion?: string;
  userAgent?: string;
}

interface ManifestState {
  discoveredFlows?: import("../manifest.js").DiscoveredTeleforgeFlowSummary[];
  error?: string;
  manifest?: TeleforgeManifest;
  manifestPath: string;
}

type ExecFileImpl = (
  file: string,
  args?: string[],
  options?: {
    cwd?: string;
  }
) => Promise<{ stderr: string; stdout: string }>;

interface PackageManifestSummary {
  filePath: string;
  packages: Map<string, string>;
}

const execFileAsync = promisify(execFile);

export async function runDoctorChecks(options: RunDoctorChecksOptions): Promise<DoctorRunResult> {
  const fixes = options.fix ? await applyDoctorFixes(options.cwd) : [];
  const env = await loadProjectEnv(options.cwd);
  const manifestState = await loadManifestState(options.cwd);
  const checks: DoctorCheck[] = [];
  const publicUrl = resolvePublicUrl(env, manifestState.manifest);
  const execRunner = options.execFileImpl ?? defaultExecFileImpl;

  checks.push(checkNodeVersion(options.nodeVersion ?? process.version));
  checks.push(
    await checkPackageManager({
      cwd: options.cwd,
      userAgent: options.userAgent ?? process.env.npm_config_user_agent
    })
  );
  checks.push(await checkGitAvailability(options.cwd, execRunner));
  checks.push(await checkTeleforgeDependencies(options.cwd, manifestState.manifest));
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
  checks.push(checkFlowWiring(manifestState));
  checks.push(await checkRuntimeSecrets(env, manifestState));
  checks.push(checkWebhookMode(env, manifestState));
  checks.push(await runClientManifestDriftCheck(options.cwd, manifestState));

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

function checkNodeVersion(version: string): DoctorCheck {
  const major = Number.parseInt(version.replace(/^v/, "").split(".")[0] ?? "", 10);

  if (!Number.isFinite(major)) {
    return {
      category: "Environment",
      message: `Unable to parse Node.js version: ${version}`,
      name: "node_version",
      remediation: "Install Node.js 20 LTS or newer before using Teleforge.",
      status: "warn"
    };
  }

  if (major < 18) {
    return {
      category: "Environment",
      message: `Node.js ${version} is too old. Teleforge requires Node.js 18 or newer.`,
      name: "node_version",
      remediation: "Upgrade with `nvm install 20 && nvm use 20` or install Node.js 20 LTS.",
      status: "error"
    };
  }

  if (major < 20) {
    return {
      category: "Environment",
      message: `Node.js ${version} is supported, but Node.js 20 LTS or newer is recommended.`,
      name: "node_version",
      remediation: "Upgrade with `nvm install 20 && nvm use 20` when convenient.",
      status: "warn"
    };
  }

  return {
    category: "Environment",
    message: `Node.js ${version} detected.`,
    name: "node_version",
    status: "pass"
  };
}

async function checkPackageManager(options: {
  cwd: string;
  userAgent?: string;
}): Promise<DoctorCheck> {
  const lockfiles = await findPresentLockfiles(options.cwd);
  const packageJson = await readJsonFileIfExists(path.join(options.cwd, "package.json"));
  const packageManagerField =
    isRecord(packageJson) && typeof packageJson.packageManager === "string"
      ? packageJson.packageManager
      : undefined;
  const manager = detectPackageManager({
    lockfiles,
    packageManagerField,
    userAgent: options.userAgent
  });

  if (lockfiles.length > 1) {
    return {
      category: "Environment",
      details: [`Detected lockfiles: ${lockfiles.join(", ")}`],
      message: "Multiple package-manager lockfiles detected.",
      name: "package_manager",
      remediation: "Keep a single lockfile in the project root to avoid inconsistent installs.",
      status: "warn"
    };
  }

  if (!manager) {
    return {
      category: "Environment",
      message: "Package manager could not be determined.",
      name: "package_manager",
      remediation:
        "Add a root package.json with a `packageManager` field and commit a lockfile. pnpm is recommended.",
      status: "warn"
    };
  }

  const details = [
    packageManagerField ? `packageManager: ${packageManagerField}` : undefined,
    options.userAgent ? `user agent: ${options.userAgent}` : undefined,
    lockfiles.length === 1 ? `lockfile: ${lockfiles[0]}` : undefined
  ].filter((detail): detail is string => Boolean(detail));

  if (manager !== "pnpm") {
    return {
      category: "Environment",
      details,
      message: `Detected ${manager}. Teleforge works best with pnpm.`,
      name: "package_manager",
      remediation: "Prefer pnpm and commit pnpm-lock.yaml for consistent workspace installs.",
      status: "warn"
    };
  }

  if (!lockfiles.includes("pnpm-lock.yaml")) {
    return {
      category: "Environment",
      details,
      message: "pnpm was detected but pnpm-lock.yaml is missing.",
      name: "package_manager",
      remediation: "Run `pnpm install` and commit pnpm-lock.yaml.",
      status: "warn"
    };
  }

  return {
    category: "Environment",
    details,
    message: "pnpm detected with a committed lockfile.",
    name: "package_manager",
    status: "pass"
  };
}

async function checkGitAvailability(cwd: string, execFileImpl: ExecFileImpl): Promise<DoctorCheck> {
  try {
    const { stdout } = await execFileImpl("git", ["--version"], { cwd });
    return {
      category: "Environment",
      details: [stdout.trim()],
      message: "Git is available.",
      name: "git_available",
      status: "pass"
    };
  } catch (error) {
    return {
      category: "Environment",
      details: [formatErrorMessage(error)],
      message: "Git is not available in PATH.",
      name: "git_available",
      remediation:
        "Install Git and confirm `git --version` succeeds before using repository workflows.",
      status: "warn"
    };
  }
}

async function checkTeleforgeDependencies(
  cwd: string,
  manifest: TeleforgeManifest | undefined
): Promise<DoctorCheck> {
  const packageFiles = await loadPackageManifestSummaries(cwd);
  const discoveredPackages = new Map<string, Set<string>>();

  for (const packageFile of packageFiles) {
    for (const [name, version] of packageFile.packages) {
      const versions = discoveredPackages.get(name) ?? new Set<string>();
      versions.add(version);
      discoveredPackages.set(name, versions);
    }
  }

  const legacyPackages = [...discoveredPackages.keys()].filter((name) =>
    name.startsWith("@teleforgex/")
  );
  if (legacyPackages.length > 0) {
    return {
      category: "Environment",
      details: legacyPackages.map((name) => `Remove ${name}`),
      message: "Split Teleforge workspace packages are no longer supported in app manifests.",
      name: "teleforge_dependencies",
      remediation: "Depend on the unified `teleforge` package only.",
      status: "error"
    };
  }

  const requiredPackages = determineRequiredTeleforgePackages(manifest);
  const missingPackages = requiredPackages.filter((name) => !discoveredPackages.has(name));
  if (missingPackages.length > 0) {
    return {
      category: "Environment",
      details: missingPackages.map((name) => `Missing ${name}`),
      message: "Required Teleforge dependencies are missing from package.json.",
      name: "teleforge_dependencies",
      remediation:
        "Install the missing Teleforge package dependencies in your workspace or app package before continuing.",
      status: "error"
    };
  }

  const majorVersions = new Set<number>();
  const versionDetails: string[] = [];
  for (const [name, versions] of discoveredPackages) {
    const sortedVersions = [...versions].sort();
    versionDetails.push(`${name}: ${sortedVersions.join(", ")}`);
    for (const version of sortedVersions) {
      const major = extractMajorVersion(version);
      if (typeof major === "number") {
        majorVersions.add(major);
      }
    }
  }

  if (majorVersions.size > 1) {
    return {
      category: "Environment",
      details: versionDetails,
      message: "Conflicting major versions detected across Teleforge dependencies.",
      name: "teleforge_dependencies",
      remediation:
        "Align all Teleforge dependencies to the same major version before running Teleforge.",
      status: "error"
    };
  }

  if (versionDetails.length === 0) {
    return {
      category: "Environment",
      message: "No Teleforge dependencies were found in the project package manifests.",
      name: "teleforge_dependencies",
      remediation: "Install the unified Teleforge framework package in your app.",
      status: "error"
    };
  }

  return {
    category: "Environment",
    details: versionDetails,
    message: "Teleforge dependencies are present and version-aligned.",
    name: "teleforge_dependencies",
    status: "pass"
  };
}

async function loadManifestState(cwd: string): Promise<ManifestState> {
  try {
    const { discoveredFlows, manifest, manifestPath } = await loadManifest(cwd);
    return {
      discoveredFlows,
      manifest,
      manifestPath
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      manifestPath: path.join(cwd, "teleforge.config.ts")
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
      message: "Teleforge app config is missing or invalid.",
      name: "manifest_consistency",
      remediation: "Create or repair teleforge.config.ts before running Teleforge commands.",
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

  if (manifest.runtime?.bot?.delivery === "webhook" && !manifest.bot?.webhook?.path) {
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

      const hasFlowCoordination =
        route.coordination &&
        typeof route.coordination === "object" &&
        "flow" in route.coordination &&
        typeof route.coordination.flow === "object" &&
        route.coordination.flow !== null &&
        "flowId" in route.coordination.flow &&
        typeof route.coordination.flow.flowId === "string";

      if (hasFlowCoordination) {
        continue;
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

  if (manifest.runtime.apiRoutes) {
    const apiRoutesPath = path.resolve(cwd, manifest.runtime.apiRoutes);
    if (!(await pathExists(apiRoutesPath))) {
      issues.push(`Runtime API routes directory not found: ${manifest.runtime.apiRoutes}`);
    }
  }

  if (issues.length > 0) {
    return {
      category: "Configuration",
      details: issues,
      message: "Teleforge app consistency checks failed.",
      name: "manifest_consistency",
      remediation: "Repair teleforge.config.ts and the referenced files before retrying.",
      status: "error"
    };
  }

  return {
    category: "Configuration",
    message: "Teleforge config fields and referenced project files look consistent.",
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
  const delivery = manifest?.runtime?.bot?.delivery ?? "polling";
  const secretEnv = manifest?.bot?.webhook?.secretEnv;

  if (delivery !== "webhook") {
    return {
      category: "Environment",
      message: "Webhook secret check skipped for polling delivery.",
      name: "webhook_secret",
      status: "pass"
    };
  }

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
        "Set TELEFORGE_PUBLIC_URL=https://your-domain.com or add miniApp.url to teleforge.config.ts.",
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
  const delivery = options.manifest?.runtime?.bot?.delivery ?? "polling";
  const webhookPath = options.manifest?.bot?.webhook?.path;

  if (delivery !== "webhook") {
    return {
      category: "Connectivity",
      message: "Webhook reachability check skipped for polling delivery.",
      name: "webhook_reachable",
      status: "pass"
    };
  }

  if (!webhookPath) {
    return {
      category: "Connectivity",
      message: "Webhook path is not configured in the manifest.",
      name: "webhook_reachable",
      remediation: "Add bot.webhook.path to teleforge.config.ts.",
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
      remediation: "Set bot.username in teleforge.config.ts before configuring BotFather.",
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

async function findPresentLockfiles(cwd: string): Promise<string[]> {
  const candidates = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lockb"];
  const present: string[] = [];

  for (const candidate of candidates) {
    if (await pathExists(path.join(cwd, candidate))) {
      present.push(candidate);
    }
  }

  return present;
}

function detectPackageManager(options: {
  lockfiles: string[];
  packageManagerField?: string;
  userAgent?: string;
}): "bun" | "npm" | "pnpm" | "yarn" | undefined {
  const packageManager = trimToUndefined(options.packageManagerField)?.split("@")[0];
  if (packageManager === "pnpm" || packageManager === "npm" || packageManager === "yarn") {
    return packageManager;
  }

  if (packageManager === "bun") {
    return "bun";
  }

  const userAgent = trimToUndefined(options.userAgent);
  if (userAgent) {
    if (userAgent.startsWith("pnpm/")) {
      return "pnpm";
    }
    if (userAgent.startsWith("npm/")) {
      return "npm";
    }
    if (userAgent.startsWith("yarn/")) {
      return "yarn";
    }
    if (userAgent.startsWith("bun/")) {
      return "bun";
    }
  }

  if (options.lockfiles.includes("pnpm-lock.yaml")) {
    return "pnpm";
  }
  if (options.lockfiles.includes("package-lock.json")) {
    return "npm";
  }
  if (options.lockfiles.includes("yarn.lock")) {
    return "yarn";
  }
  if (options.lockfiles.includes("bun.lockb")) {
    return "bun";
  }

  return undefined;
}

async function loadPackageManifestSummaries(cwd: string): Promise<PackageManifestSummary[]> {
  const packageJsonPaths = new Set<string>([path.join(cwd, "package.json")]);

  for (const directory of ["apps", "packages"]) {
    const directoryPath = path.join(cwd, directory);
    if (!(await pathExists(directoryPath))) {
      continue;
    }

    const entries = await readdir(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      packageJsonPaths.add(path.join(directoryPath, entry.name, "package.json"));
    }
  }

  const manifests: PackageManifestSummary[] = [];
  for (const packageJsonPath of packageJsonPaths) {
    const packageJson = await readJsonFileIfExists(packageJsonPath);
    if (!isRecord(packageJson)) {
      continue;
    }

    const packages = new Map<string, string>();
    for (const field of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies"
    ]) {
      const section = packageJson[field];
      if (!isRecord(section)) {
        continue;
      }

      for (const [name, version] of Object.entries(section)) {
        if (
          (name !== "teleforge" && !name.startsWith("@teleforgex/")) ||
          typeof version !== "string"
        ) {
          continue;
        }
        packages.set(name, version);
      }
    }

    if (packages.size > 0) {
      manifests.push({
        filePath: packageJsonPath,
        packages
      });
    }
  }

  return manifests;
}

function determineRequiredTeleforgePackages(_manifest: TeleforgeManifest | undefined): string[] {
  return ["teleforge"];
}

function extractMajorVersion(version: string): number | undefined {
  let normalized = version.trim();
  if (normalized.startsWith("workspace:")) {
    normalized = normalized.slice("workspace:".length);
  }

  const match = normalized.match(/(\d+)(?:\.\d+)?(?:\.\d+)?/);
  if (!match) {
    return undefined;
  }

  const major = Number.parseInt(match[1], 10);
  return Number.isFinite(major) ? major : undefined;
}

function checkFlowWiring(manifestState: ManifestState): DoctorCheck {
  if (manifestState.error) {
    return {
      category: "Configuration",
      message: "Flow wiring check skipped because the manifest could not be loaded.",
      name: "flow_wiring",
      status: "warn"
    };
  }

  const flows = manifestState.discoveredFlows ?? [];
  const details: string[] = [];
  let errorCount = 0;
  let warnCount = 0;

  for (const flow of flows) {
    const flowHeader = `Flow: ${flow.id}`;
    const flowDetails: string[] = [];

    for (const step of flow.steps) {
      const stepPrefix = `  Step: ${step.id}`;

      if (step.type === "miniapp" && step.screen && step.screenResolved === false) {
        flowDetails.push(
          `${stepPrefix} references screen "${step.screen}", but no matching screen was discovered under apps/web/src/screens.`
        );
        errorCount += 1;
      }

      if (step.type === "miniapp" && !step.screen) {
        flowDetails.push(`${stepPrefix} is a Mini App step but has no screen id.`);
        errorCount += 1;
      }

      if (step.unresolvedActionIds.length > 0) {
        for (const actionId of step.unresolvedActionIds) {
          flowDetails.push(
            `${stepPrefix} action "${actionId}" has no transition target or handler.`
          );
          errorCount += 1;
        }
      }

      if (step.extraActionHandlerIds.length > 0) {
        for (const handlerId of step.extraActionHandlerIds) {
          flowDetails.push(
            `${stepPrefix} discovered extra action handler "${handlerId}" not declared in the flow.`
          );
          warnCount += 1;
        }
      }

      if (step.extraServerActionIds.length > 0) {
        for (const serverId of step.extraServerActionIds) {
          flowDetails.push(
            `${stepPrefix} discovered extra server hook "${serverId}" not declared in the flow.`
          );
          warnCount += 1;
        }
      }
    }

    if (flow.hasWiringGaps) {
      const allSteps = flow.steps.map((s) => `    ${s.id}: ${s.status}`);
      flowDetails.unshift(...allSteps);
    }

    if (flowDetails.length > 0) {
      details.push(flowHeader);
      details.push(...flowDetails);
    }
  }

  if (errorCount > 0) {
    return {
      category: "Configuration",
      details,
      message: `${errorCount} flow wiring issue${errorCount === 1 ? "" : "s"} found across ${flows.length} flow${flows.length === 1 ? "" : "s"}.`,
      name: "flow_wiring",
      remediation:
        "Add missing screens, declare action transitions or handlers, and remove orphaned handlers.",
      status: "error"
    };
  }

  if (warnCount > 0) {
    return {
      category: "Configuration",
      details,
      message: `${warnCount} flow wiring warning${warnCount === 1 ? "" : "s"} found across ${flows.length} flow${flows.length === 1 ? "" : "s"}.`,
      name: "flow_wiring",
      remediation: "Review discovered extra handlers and server hooks that are not referenced by flows.",
      status: "warn"
    };
  }

  if (flows.length === 0) {
    return {
      category: "Configuration",
      message: "No flows discovered for wiring checks.",
      name: "flow_wiring",
      status: "pass"
    };
  }

  return {
    category: "Configuration",
    details,
    message: `All ${flows.length} flow${flows.length === 1 ? "" : "s"} wired cleanly with no missing screens, unresolved actions, or orphaned handlers.`,
    name: "flow_wiring",
    status: "pass"
  };
}

async function readJsonFileIfExists(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

async function checkRuntimeSecrets(
  env: NodeJS.ProcessEnv,
  manifestState: ManifestState
): Promise<DoctorCheck> {
  const manifest = manifestState.manifest;

  if (!manifest) {
    return {
      category: "Configuration",
      message: "Runtime secrets check skipped because the manifest could not be loaded.",
      name: "runtime_secrets",
      status: "warn"
    };
  }

  const tokenEnv = manifest.bot?.tokenEnv ?? "BOT_TOKEN";
  const token = env[tokenEnv];
  const hasToken = hasRealValue(token);
  const issues: string[] = [];

  if (hasToken) {
    const flowSecret = env.TELEFORGE_FLOW_SECRET;
    if (!hasRealValue(flowSecret)) {
      issues.push("TELEFORGE_FLOW_SECRET is required in live mode (when BOT_TOKEN is set).");
    }

    const miniAppUrl = env.MINI_APP_URL ?? env.TELEFORGE_PUBLIC_URL;
    if (!miniAppUrl || miniAppUrl.trim().length === 0) {
      issues.push("MINI_APP_URL or TELEFORGE_PUBLIC_URL is required in live mode.");
    }
  }

  const phoneAuthSecretEnv = manifest.runtime?.phoneAuth?.secretEnv ?? "PHONE_AUTH_SECRET";
  const phoneAuthSecret = env[phoneAuthSecretEnv];
  const usesPhoneAuth = await hasPhoneAuthUsage(manifestState);
  if (!hasRealValue(phoneAuthSecret) && usesPhoneAuth) {
    issues.push(
      `${phoneAuthSecretEnv} is not set. Phone-auth flows (requestPhoneAuthAction) are used in this app.`
    );
  }

  if (issues.length === 0) {
    return {
      category: "Configuration",
      message: hasToken
        ? "All required runtime secrets are configured for live mode."
        : "Runtime secrets look sufficient for preview/development mode.",
      name: "runtime_secrets",
      status: "pass"
    };
  }

  const hasErrors = hasToken && issues.some((i) => i.includes("required"));

  return {
    category: "Configuration",
    details: issues,
    message: hasErrors
      ? "Required runtime secrets are missing for live mode."
      : "Some runtime secrets are missing; specific features may fail.",
    name: "runtime_secrets",
    remediation:
      "Add the missing secrets to .env or the shell environment before starting the app.",
    status: hasErrors ? "error" : "warn"
  };
}

async function hasPhoneAuthUsage(manifestState: ManifestState): Promise<boolean> {
  if (!manifestState.discoveredFlows) {
    return false;
  }

  for (const flow of manifestState.discoveredFlows) {
    if (!flow.filePath) {
      continue;
    }

    try {
      const content = await readFile(flow.filePath, "utf8");
      if (
        content.includes("requestPhoneAuthAction") ||
        (content.includes("phoneRequest") && content.includes("auth"))
      ) {
        return true;
      }
    } catch {
      // Ignore read errors; heuristic is best-effort
    }
  }

  return false;
}

function checkWebhookMode(
  env: NodeJS.ProcessEnv,
  manifestState: ManifestState
): DoctorCheck {
  const manifest = manifestState.manifest;

  if (!manifest) {
    return {
      category: "Configuration",
      message: "Webhook mode check skipped because the manifest could not be loaded.",
      name: "webhook_mode",
      status: "warn"
    };
  }

  const delivery = manifest.runtime?.bot?.delivery ?? "polling";

  if (delivery !== "webhook") {
    return {
      category: "Configuration",
      message: "Bot delivery mode is polling (default).",
      name: "webhook_mode",
      status: "pass"
    };
  }

  const tokenEnv = manifest.bot?.tokenEnv ?? "BOT_TOKEN";
  const token = env[tokenEnv];
  if (!hasRealValue(token)) {
    return {
      category: "Configuration",
      details: ["Webhook mode requires a live bot token."],
      message: "Webhook mode is enabled but no bot token is configured.",
      name: "webhook_mode",
      remediation: `Set ${tokenEnv} to a real Telegram bot token before enabling webhook mode.`,
      status: "error"
    };
  }

  const webhookPath = manifest.bot?.webhook?.path;
  if (!webhookPath) {
    return {
      category: "Configuration",
      details: ["bot.webhook.path is not set in teleforge.config.ts."],
      message: "Webhook mode is enabled but no webhook path is configured.",
      name: "webhook_mode",
      remediation: "Add bot.webhook.path to teleforge.config.ts.",
      status: "error"
    };
  }

  const webhookSecretEnv = manifest.bot?.webhook?.secretEnv;
  if (!webhookSecretEnv) {
    return {
      category: "Configuration",
      details: ["bot.webhook.secretEnv is not set in teleforge.config.ts."],
      message: "Webhook mode is enabled but no webhook secret env is configured.",
      name: "webhook_mode",
      remediation: "Add bot.webhook.secretEnv to teleforge.config.ts for webhook signature validation.",
      status: "warn"
    };
  }

  const webhookSecret = env[webhookSecretEnv];
  if (!hasRealValue(webhookSecret)) {
    return {
      category: "Configuration",
      details: [`${webhookSecretEnv} is missing or uses a placeholder.`],
      message: "Webhook secret is not configured.",
      name: "webhook_mode",
      remediation: `Set ${webhookSecretEnv} in .env for webhook signature validation.`,
      status: "warn"
    };
  }

  return {
    category: "Configuration",
    details: [
      `Delivery mode: webhook`,
      `Webhook path: ${webhookPath}`,
      `Webhook secret env: ${webhookSecretEnv}`
    ],
    message:
      "Webhook mode is configured and ready. Run `teleforge start` to start the webhook server.",
    name: "webhook_mode",
    status: "pass"
  };
}

async function runClientManifestDriftCheck(
  cwd: string,
  manifestState: ManifestState
): Promise<DoctorCheck> {
  if (!manifestState.manifest) {
    return {
      category: "Configuration",
      message: "Client manifest drift check skipped because the manifest could not be loaded.",
      name: "client_manifest_drift",
      status: "warn"
    };
  }

  const discoveredFlows = manifestState.discoveredFlows ?? [];
  if (discoveredFlows.length === 0) {
    return {
      category: "Configuration",
      message: "No flows discovered; client manifest drift check skipped.",
      name: "client_manifest_drift",
      status: "pass"
    };
  }

  const manifestPath = path.join(
    cwd,
    "apps",
    "web",
    "src",
    "teleforge-generated",
    "client-flow-manifest.ts"
  );

  const drift = await checkClientManifestDrift({ manifestPath, discoveredFlows });

  if (drift.isStale) {
    const details: string[] = [];
    if (drift.reason?.includes("missing")) {
      details.push(`Expected manifest at ${manifestPath}`);
    }
    if (drift.reason) {
      details.push(drift.reason);
    }

    return {
      category: "Configuration",
      details,
      message: drift.reason?.includes("missing")
        ? "Client manifest is missing. Flows are discovered but no checked-in manifest was found."
        : "Client manifest is out of sync with discovered flows.",
      name: "client_manifest_drift",
      remediation: "Run `teleforge generate client-manifest` to regenerate the client-safe flow metadata.",
      status: "warn"
    };
  }

  return {
    category: "Configuration",
    message: "Client manifest is in sync with discovered flows.",
    name: "client_manifest_drift",
    status: "pass"
  };
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function defaultExecFileImpl(
  file: string,
  args: string[] = [],
  options?: { cwd?: string }
): Promise<{ stderr: string; stdout: string }> {
  return execFileAsync(file, args, {
    cwd: options?.cwd
  });
}
