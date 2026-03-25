import { accessSync, constants as fsConstants, watch } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import process from "node:process";
import { spawn, type ChildProcess } from "node:child_process";
import httpProxy from "http-proxy";
import { ensureCertificates } from "./certs.js";
import { loadProjectEnv, validateRequiredEnv } from "./env.js";
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
  env: NodeJS.ProcessEnv;
  externalPort: number;
  frameworkLabel: string;
  manifest: TeleforgeManifest;
  requestedPort: number;
  tunnelUrl?: string;
  tunnelWarning?: string;
  url: string;
}

export interface ManagedDevCommandOptions {
  defaultPort: number;
  flags: SharedCommandFlags;
  htmlTransformer?: (html: string) => string;
  onStarted?: (context: ManagedDevContext) => Promise<void> | void;
  requiredEnv?: string[];
  tunnelProvider?: TunnelProvider;
  subdomain?: string;
}

interface RuntimeHandle {
  child: ChildProcess;
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

    const monitorRuntime = (activeRuntime: RuntimeHandle, rejectRun: (reason?: unknown) => void) => {
      activeRuntime.child.once("exit", async (code) => {
        if (stopping || activeRuntime.disposing) {
          return;
        }

        await stop();
        rejectRun(new Error(`Dev server exited unexpectedly with code ${code ?? "unknown"}.`));
      });
    };

    const handleSignal = async () => {
      await stop();
      resolve();
    };

    process.once("SIGINT", handleSignal);
    process.once("SIGTERM", handleSignal);
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
  const env = await loadProjectEnv(options.flags.cwd);
  const missing = validateRequiredEnv(env, options.requiredEnv ?? []);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. Add them to .env before starting teleforge.`
    );
  }

  const requestedPort = resolveRequestedPort(options.flags.port, env.TELEFORGE_DEV_PORT, options.defaultPort);
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
    certificates
  });

  let tunnel: TunnelHandle | undefined;
  let tunnelWarning: string | undefined;

  if (options.flags.tunnel) {
    try {
      tunnel = await startTunnel({
        port: externalPort,
        provider: options.tunnelProvider ?? "localtunnel",
        subdomain: options.subdomain
      } satisfies StartTunnelOptions);
    } catch (error) {
      tunnelWarning =
        error instanceof Error
          ? error.message
          : "Tunnel startup failed. Continuing with local HTTPS only.";
    }
  }

  const context: ManagedDevContext = {
    childPort,
    env,
    externalPort,
    frameworkLabel: manifest.runtime.webFramework === "vite" ? "Vite" : "Next.js",
    manifest,
    requestedPort,
    tunnelUrl: tunnel?.url,
    tunnelWarning,
    url
  };

  await options.onStarted?.(context);

  const handle: RuntimeHandle = {
    child,
    disposing: false,
    tunnel,
    context,
    proxy,
    server,
    async cleanup() {
      handle.disposing = true;
      proxy.close();
      await closeServer(server);
      if (tunnel) {
        await tunnel.cleanup();
      }
      if (!child.killed) {
        child.kill("SIGTERM");
        await onceExit(child, 5_000);
      }
    }
  };

  return handle;
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
  htmlTransformer?: (html: string) => string;
  https: boolean;
  certificates?: { certPath: string; keyPath: string };
}): Promise<{ proxy: httpProxy; server: http.Server | https.Server; url: string }> {
  const proxy = httpProxy.createProxyServer({
    changeOrigin: true,
    selfHandleResponse: Boolean(options.htmlTransformer),
    target: `http://127.0.0.1:${options.childPort}`,
    ws: true
  });

  if (options.htmlTransformer) {
    proxy.on("proxyRes", (proxyResponse, _request, response) => {
      const chunks: Buffer[] = [];
      proxyResponse.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      proxyResponse.on("end", () => {
        const body = Buffer.concat(chunks);
        const headers = { ...proxyResponse.headers };
        const contentType = String(headers["content-type"] ?? "");
        const contentEncoding = String(headers["content-encoding"] ?? "");
        const shouldTransform =
          contentType.includes("text/html") && contentEncoding.length === 0;

        const payload = shouldTransform
          ? Buffer.from(options.htmlTransformer?.(body.toString("utf8")) ?? body.toString("utf8"))
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

async function closeServer(server: http.Server | https.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
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
