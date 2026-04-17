import { spawn, type ChildProcess } from "node:child_process";
import { accessSync, constants as fsConstants, watch } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import process from "node:process";

import httpProxy from "http-proxy";

import { ensureCertificates } from "./certs.js";
import { inspectProjectEnv, validateRequiredEnv } from "./env.js";
import { loadManifest, type TeleforgeManifest } from "./manifest.js";
import { findAvailablePort, waitForPort } from "./ports.js";
import {
  startTunnel,
  type StartTunnelOptions,
  type TunnelHandle,
  type TunnelProvider
} from "./tunnel.js";

export interface SharedCommandFlags {
  cwd: string;
  https: boolean;
  port?: number;
  tunnel: boolean;
}

export interface ManagedDevContext {
  childPort: number;
  companionServices: string[];
  env: NodeJS.ProcessEnv;
  externalPort: number;
  frameworkLabel: string;
  loadedEnvFiles: string[];
  manifest: TeleforgeManifest;
  requestedPort: number;
  tunnelUrl?: string;
  tunnelWarning?: string;
  url: string;
}

export interface ManagedDevCommandOptions {
  defaultPort: number;
  flags: SharedCommandFlags;
  htmlTransformer?: (html: string, requestPath: string) => string;
  onStarted?: (context: ManagedDevContext) => Promise<void> | void;
  requestHandler?: (
    request: http.IncomingMessage,
    response: http.ServerResponse<http.IncomingMessage>
  ) => Promise<boolean> | boolean;
  requiredEnv?: string[];
  proxyMountPath?: string;
  tunnelProvider?: TunnelProvider;
  subdomain?: string;
}

interface RuntimeHandle {
  child: ChildProcess;
  companionServices: CompanionServiceHandle[];
  disposing: boolean;
  tunnel?: TunnelHandle;
  context: ManagedDevContext;
  proxy: httpProxy;
  server: http.Server | https.Server;
  cleanup(): Promise<void>;
}

export async function runManagedDevCommand(options: ManagedDevCommandOptions): Promise<void> {
  let stopping = false;
  let runtime = await startRuntime(options);

  await new Promise<void>((resolve, reject) => {
    const watchers = watchProjectFiles(options.flags.cwd, async (filename) => {
      console.log(`↻ Restarting because ${filename} changed...`);
      runtime = await restartRuntime(runtime, options);
      monitorRuntime(runtime, reject);
    });

    const stop = async () => {
      if (stopping) {
        return;
      }

      stopping = true;
      for (const watcher of watchers) {
        watcher.close();
      }
      await runtime.cleanup();
    };

    const monitorRuntime = (
      activeRuntime: RuntimeHandle,
      rejectRun: (reason?: unknown) => void
    ) => {
      activeRuntime.child.once("exit", async (code) => {
        if (stopping || activeRuntime.disposing) {
          return;
        }

        await stop();
        rejectRun(new Error(`Dev server exited unexpectedly with code ${code ?? "unknown"}.`));
      });

      for (const service of activeRuntime.companionServices) {
        service.child.once("exit", (code) => {
          if (stopping || activeRuntime.disposing) {
            return;
          }

          console.log(
            `Warning: Companion service ${service.label} exited with code ${code ?? "unknown"}.`
          );
        });
      }
    };

    let signalCount = 0;
    const onSignal = async () => {
      signalCount += 1;
      if (signalCount === 1) {
        await stop();
        resolve();
        process.exit(0);
        return;
      }

      runtime.child.kill("SIGKILL");
      for (const service of runtime.companionServices) {
        service.child.kill("SIGKILL");
      }
      process.exit(1);
    };

    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
    monitorRuntime(runtime, reject);
  });
}

async function restartRuntime(
  current: RuntimeHandle,
  options: ManagedDevCommandOptions
): Promise<RuntimeHandle> {
  await current.cleanup();
  return startRuntime(options);
}

async function startRuntime(options: ManagedDevCommandOptions): Promise<RuntimeHandle> {
  const { manifest } = await loadManifest(options.flags.cwd);
  const projectEnv = await inspectProjectEnv(options.flags.cwd);
  const env = projectEnv.env;
  const missing = validateRequiredEnv(env, options.requiredEnv ?? []);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. Add them to .env before starting teleforge.`
    );
  }

  const requestedPort = resolveRequestedPort(
    options.flags.port,
    env.TELEFORGE_DEV_PORT,
    options.defaultPort
  );
  const externalPort = await findAvailablePort(requestedPort);
  const childPort = await findAvailablePort(
    externalPort === requestedPort ? requestedPort + 1 : externalPort + 1
  );
  const webDirectory = path.join(options.flags.cwd, "apps", "web");
  await ensureDirectory(webDirectory, "Missing apps/web. Generate a Teleforge project first.");

  const child = spawnFrameworkServer({
    childPort,
    cwd: options.flags.cwd,
    env,
    manifest,
    webDirectory
  });

  await waitForPort(childPort, 30_000);

  const certificates = options.flags.https
    ? await ensureCertificates(options.flags.cwd)
    : undefined;
  const { proxy, server, url } = await startProxyServer({
    childPort,
    externalPort,
    htmlTransformer: options.htmlTransformer,
    https: options.flags.https,
    certificates,
    proxyMountPath: options.proxyMountPath,
    requestHandler: options.requestHandler
  });

  let tunnel: TunnelHandle | undefined;
  let tunnelWarning: string | undefined;

  if (options.flags.tunnel) {
    try {
      tunnel = await startTunnel({
        https: options.flags.https,
        // Tunnel the port we actually bound, not the user's requested default.
        port: externalPort,
        provider: options.tunnelProvider ?? "cloudflare",
        subdomain: options.subdomain
      } satisfies StartTunnelOptions);
    } catch (error) {
      tunnelWarning =
        error instanceof Error
          ? error.message
          : "Tunnel startup failed. Continuing with local HTTPS only.";
    }
  }

  const publicUrl = tunnel?.url ?? url;
  const companionServices = await spawnCompanionServices({
    cwd: options.flags.cwd,
    env,
    publicUrl
  });

  const context: ManagedDevContext = {
    childPort,
    companionServices: companionServices.map((service) => service.label),
    env,
    externalPort,
    frameworkLabel: manifest.runtime.webFramework === "vite" ? "Vite" : "Next.js",
    loadedEnvFiles: projectEnv.loadedFiles,
    manifest,
    requestedPort,
    tunnelUrl: tunnel?.url,
    tunnelWarning,
    url
  };

  await options.onStarted?.(context);

  const handle: RuntimeHandle = {
    child,
    companionServices,
    disposing: false,
    tunnel,
    context,
    proxy,
    server,
    async cleanup() {
      handle.disposing = true;

      const childExit = !child.killed
        ? (child.kill("SIGTERM"), onceExit(child, 5_000))
        : Promise.resolve();
      const companionExits = Promise.all(companionServices.map((service) => service.cleanup()));

      proxy.close();

      await Promise.all([closeServer(server, 5_000), childExit, companionExits]);

      if (tunnel) {
        await tunnel.cleanup();
      }
    }
  };

  return handle;
}

interface CompanionServiceDefinition {
  cwd: string;
  label: string;
}

interface CompanionServiceHandle extends CompanionServiceDefinition {
  child: ChildProcess;
  cleanup(): Promise<void>;
}

async function spawnCompanionServices(options: {
  cwd: string;
  env: NodeJS.ProcessEnv;
  publicUrl: string;
}): Promise<CompanionServiceHandle[]> {
  const definitions = await discoverCompanionServices(options.cwd);
  const handles: CompanionServiceHandle[] = [];

  for (const definition of definitions) {
    const child = spawn("pnpm", ["dev"], {
      cwd: definition.cwd,
      env: buildCompanionEnv(options.env, options.publicUrl),
      stdio: "inherit"
    });

    handles.push({
      ...definition,
      child,
      async cleanup() {
        if (child.exitCode !== null || child.killed) {
          return;
        }

        child.kill("SIGTERM");
        await onceExit(child, 5_000);
      }
    });
  }

  return handles;
}

async function discoverCompanionServices(cwd: string): Promise<CompanionServiceDefinition[]> {
  const appsDirectory = path.join(cwd, "apps");

  try {
    const entries = await readdir(appsDirectory, { withFileTypes: true });
    const definitions: CompanionServiceDefinition[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === "web") {
        continue;
      }

      if (entry.name !== "bot") {
        continue;
      }

      const serviceDirectory = path.join(appsDirectory, entry.name);
      const manifestPath = path.join(serviceDirectory, "package.json");

      try {
        const packageJson = JSON.parse(await readFile(manifestPath, "utf8")) as {
          scripts?: Record<string, string>;
        };

        if (!packageJson.scripts?.dev) {
          continue;
        }

        definitions.push({
          cwd: serviceDirectory,
          label: entry.name
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          continue;
        }
        throw error;
      }
    }

    return definitions;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function buildCompanionEnv(env: NodeJS.ProcessEnv, publicUrl: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...env,
    MINI_APP_URL: preferNonEmptyEnv(env.MINI_APP_URL, publicUrl),
    TELEFORGE_PUBLIC_URL: publicUrl
  };
}

function preferNonEmptyEnv(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function spawnFrameworkServer(options: {
  childPort: number;
  cwd: string;
  env: NodeJS.ProcessEnv;
  manifest: TeleforgeManifest;
  webDirectory: string;
}): ChildProcess {
  const binary = resolveBinary(options.cwd, options.manifest.runtime.webFramework);
  const args =
    options.manifest.runtime.webFramework === "vite"
      ? ["--host", "127.0.0.1", "--port", String(options.childPort), "--strictPort"]
      : ["dev", "--hostname", "127.0.0.1", "--port", String(options.childPort)];

  return spawn(binary, args, {
    cwd: options.webDirectory,
    env: {
      ...process.env,
      ...options.env,
      PORT: String(options.childPort)
    },
    stdio: "inherit"
  });
}

async function startProxyServer(options: {
  childPort: number;
  externalPort: number;
  htmlTransformer?: (html: string, requestPath: string) => string;
  https: boolean;
  certificates?: { certPath: string; keyPath: string };
  proxyMountPath?: string;
  requestHandler?: (
    request: http.IncomingMessage,
    response: http.ServerResponse<http.IncomingMessage>
  ) => Promise<boolean> | boolean;
}): Promise<{ proxy: httpProxy; server: http.Server | https.Server; url: string }> {
  const proxy = httpProxy.createProxyServer({
    changeOrigin: true,
    selfHandleResponse: Boolean(options.htmlTransformer),
    target: `http://127.0.0.1:${options.childPort}`,
    ws: true
  });

  proxy.on("error", (error, request, response) => {
    const message = error instanceof Error ? error.message : "Unexpected upstream proxy error.";
    logDevServerError(
      `Proxy request failed for ${formatRequestLabel(request as http.IncomingMessage)}.`,
      message
    );

    if (
      response &&
      "writeHead" in response &&
      typeof response.writeHead === "function" &&
      !response.headersSent
    ) {
      response.writeHead(502, {
        "content-type": "text/plain; charset=utf-8"
      });
      response.end("Teleforge could not reach the local app server. Check the terminal logs.");
    }
  });

  if (options.htmlTransformer) {
    proxy.on("proxyRes", (proxyResponse, _request, response) => {
      const chunks: Buffer[] = [];
      proxyResponse.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      proxyResponse.on("end", () => {
        const body = Buffer.concat(chunks);
        if ((proxyResponse.statusCode ?? 200) >= 500) {
          logDevServerError(
            `Upstream app responded with HTTP ${proxyResponse.statusCode ?? 500} for ${formatRequestLabel(_request)}.`,
            summarizeUpstreamBody(body, proxyResponse.headers["content-type"])
          );
        }
        const headers = { ...proxyResponse.headers };
        const contentType = String(headers["content-type"] ?? "");
        const contentEncoding = String(headers["content-encoding"] ?? "");
        const shouldTransform = contentType.includes("text/html") && contentEncoding.length === 0;

        const payload = shouldTransform
          ? Buffer.from(
              options.htmlTransformer?.(body.toString("utf8"), String(_request.url ?? "/")) ??
                body.toString("utf8")
            )
          : body;

        delete headers["content-length"];
        if (shouldTransform) {
          headers["content-length"] = String(payload.byteLength);
        }

        response.writeHead(proxyResponse.statusCode ?? 200, headers);
        response.end(payload);
      });
    });
  }

  const requestHandler = (
    request: http.IncomingMessage,
    response: http.ServerResponse<http.IncomingMessage>
  ) => {
    const customHandlerResult = options.requestHandler?.(request, response);
    if (customHandlerResult instanceof Promise) {
      void customHandlerResult
        .then((handled) => {
          if (!handled) {
            proxyRequest(request, response, options.proxyMountPath);
          }
        })
        .catch((error) => {
          logDevServerError(
            `Simulator request failed for ${formatRequestLabel(request)}.`,
            error instanceof Error ? (error.stack ?? error.message) : String(error)
          );
          response.statusCode = 500;
          response.end(
            error instanceof Error ? error.message : "Unexpected Teleforge dev server error."
          );
        });
      return;
    }

    if (customHandlerResult) {
      return;
    }

    proxyRequest(request, response, options.proxyMountPath);
  };

  const proxyRequest = (
    request: http.IncomingMessage,
    response: http.ServerResponse<http.IncomingMessage>,
    proxyMountPath?: string
  ) => {
    const telemetryRequest = request as typeof request & {
      __teleforgeOriginalUrl?: string;
    };
    telemetryRequest.__teleforgeOriginalUrl ??= request.url;

    if (
      proxyMountPath &&
      typeof request.url === "string" &&
      request.url.startsWith(proxyMountPath)
    ) {
      const nextUrl = request.url.slice(proxyMountPath.length);
      request.url = nextUrl.length > 0 ? nextUrl : "/";
    }
    proxy.web(request, response);
  };

  const server = options.https
    ? https.createServer(
        {
          cert: await readFileSafe(options.certificates?.certPath),
          key: await readFileSafe(options.certificates?.keyPath)
        },
        requestHandler
      )
    : http.createServer(requestHandler);

  server.on("upgrade", (request, socket, head) => {
    proxy.ws(request, socket, head);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.externalPort, "0.0.0.0", () => resolve());
  });

  const protocol = options.https ? "https" : "http";
  return {
    proxy,
    server,
    url: `${protocol}://localhost:${options.externalPort}`
  };
}

function watchProjectFiles(
  cwd: string,
  onChange: (filename: string) => Promise<void>
): Array<ReturnType<typeof watch>> {
  const files = new Set(["teleforge.app.json", ".env", ".env.local"]);
  let timer: NodeJS.Timeout | undefined;

  return [
    watch(cwd, { persistent: true }, (_eventType, filename) => {
      const basename = filename?.toString();
      if (!basename || !files.has(basename)) {
        return;
      }

      if (timer) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => {
        void onChange(basename);
      }, 150);
    })
  ];
}

function resolveRequestedPort(
  cliPort: number | undefined,
  envPort: string | undefined,
  defaultPort: number
): number {
  if (typeof cliPort === "number" && Number.isInteger(cliPort) && cliPort > 0) {
    return cliPort;
  }

  if (envPort) {
    const parsed = Number.parseInt(envPort, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return defaultPort;
}

function resolveBinary(cwd: string, framework: "vite" | "nextjs"): string {
  const binaryName = framework === "vite" ? "vite" : "next";
  const candidates = [
    path.join(cwd, "node_modules", ".bin", binaryName),
    path.join(cwd, "apps", "web", "node_modules", ".bin", binaryName)
  ];

  for (const candidate of candidates) {
    try {
      accessSync(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    `Could not find the ${binaryName} binary. Install project dependencies before running teleforge.`
  );
}

async function ensureDirectory(directory: string, errorMessage: string): Promise<void> {
  try {
    const result = await stat(directory);
    if (!result.isDirectory()) {
      throw new Error(errorMessage);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(errorMessage);
    }
    throw error;
  }
}

async function closeServer(
  server: http.Server | https.Server,
  timeoutMs: number = 5_000
): Promise<void> {
  await Promise.race([
    new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    }),
    new Promise<void>((resolve) => {
      setTimeout(resolve, timeoutMs);
    })
  ]);
}

async function onceExit(child: ChildProcess, timeoutMs: number): Promise<void> {
  await Promise.race([
    new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
    }),
    new Promise<void>((resolve) => {
      setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, timeoutMs);
    })
  ]);
}

async function readFileSafe(filePath: string | undefined): Promise<string | undefined> {
  if (!filePath) {
    return undefined;
  }

  const file = await import("node:fs/promises");
  return file.readFile(filePath, "utf8");
}

function formatRequestLabel(request: http.IncomingMessage): string {
  const telemetryRequest = request as typeof request & {
    __teleforgeOriginalUrl?: string;
  };
  return `${request.method ?? "GET"} ${telemetryRequest.__teleforgeOriginalUrl ?? request.url ?? "/"}`;
}

function summarizeUpstreamBody(
  body: Buffer,
  contentTypeHeader: string | string[] | undefined
): string | undefined {
  const contentType = String(
    Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : (contentTypeHeader ?? "")
  );
  if (
    !contentType.includes("text/") &&
    !contentType.includes("application/json") &&
    !contentType.includes("application/problem+json")
  ) {
    return undefined;
  }

  const preview = body.toString("utf8").replace(/\s+/g, " ").trim().slice(0, 300);

  return preview.length > 0 ? preview : undefined;
}

function logDevServerError(summary: string, details?: string): void {
  console.error(`[teleforge:dev] ${summary}`);
  if (details) {
    console.error(`[teleforge:dev] ${details}`);
  }
}
