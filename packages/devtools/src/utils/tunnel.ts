import { spawn, type ChildProcess } from "node:child_process";
import { accessSync, constants as fsConstants } from "node:fs";

import localtunnel from "localtunnel";

export type TunnelProvider = "cloudflare" | "localtunnel" | "ngrok";

export interface StartTunnelOptions {
  https?: boolean;
  port: number;
  provider: TunnelProvider;
  subdomain?: string;
}

export interface TunnelHandle {
  provider: TunnelProvider;
  url: string;
  cleanup(): Promise<void>;
}

interface StartTunnelDependencies {
  createLocaltunnel?: typeof localtunnel;
  fetchImpl?: typeof fetch;
  spawnProcess?: typeof spawn;
}

export async function startTunnel(
  options: StartTunnelOptions,
  dependencies: StartTunnelDependencies = {}
): Promise<TunnelHandle> {
  if (options.provider === "cloudflare") {
    return startCloudflareTunnel(options, dependencies);
  }

  if (options.provider === "ngrok") {
    return startNgrokTunnel(options, dependencies);
  }

  const createLocaltunnel = dependencies.createLocaltunnel ?? localtunnel;
  const tunnel = await createLocaltunnel({
    allow_invalid_cert: options.https,
    local_https: options.https,
    port: options.port,
    subdomain: options.subdomain
  });

  return {
    provider: "localtunnel",
    url: tunnel.url,
    async cleanup() {
      await tunnel.close();
    }
  };
}

async function startCloudflareTunnel(
  options: StartTunnelOptions,
  dependencies: StartTunnelDependencies
): Promise<TunnelHandle> {
  if (options.subdomain) {
    throw new Error(
      "Cloudflare quick tunnels do not support --subdomain. Omit it or switch to ngrok/localtunnel."
    );
  }

  const spawnProcess = dependencies.spawnProcess ?? spawn;
  const args = ["tunnel", "--url", buildOriginUrl(options), "--loglevel", "info"];
  if (options.https) {
    args.push("--no-tls-verify");
  }

  const child = spawnProcess("cloudflared", args, {
    stdio: ["ignore", "pipe", "pipe"]
  });

  const url = await waitForTunnelUrlFromOutput({
    child,
    exitMessage: "cloudflared exited before publishing a public URL.",
    matcher: /https:\/\/[-a-z0-9]+\.trycloudflare\.com/iu,
    timeoutMessage: "Timed out waiting for cloudflared to publish a public URL.",
    timeoutMs: 15_000
  });

  return {
    provider: "cloudflare",
    url,
    async cleanup() {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
      await onceExit(child, 5_000);
    }
  };
}

async function startNgrokTunnel(
  options: StartTunnelOptions,
  dependencies: StartTunnelDependencies
): Promise<TunnelHandle> {
  accessSync("/usr/bin/env", fsConstants.X_OK);
  const spawnProcess = dependencies.spawnProcess ?? spawn;

  const args = ["http", String(options.port), "--log=stdout"];
  if (options.subdomain) {
    args.push("--domain", options.subdomain);
  }

  const child = spawnProcess("ngrok", args, {
    stdio: ["ignore", "pipe", "pipe"]
  });

  const url = await waitForNgrokUrl(child, dependencies.fetchImpl ?? fetch);

  return {
    provider: "ngrok",
    url,
    async cleanup() {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
      await onceExit(child, 5_000);
    }
  };
}

async function waitForNgrokUrl(child: ChildProcess, fetchImpl: typeof fetch): Promise<string> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 15_000) {
    if (child.exitCode !== null) {
      throw new Error("ngrok exited before publishing a tunnel URL.");
    }

    try {
      const response = await fetchImpl("http://127.0.0.1:4040/api/tunnels");
      if (!response.ok) {
        await sleep(300);
        continue;
      }

      const payload = (await response.json()) as {
        tunnels?: Array<{ public_url?: string }>;
      };
      const publicUrl = payload.tunnels?.find((entry) =>
        entry.public_url?.startsWith("https://")
      )?.public_url;
      if (publicUrl) {
        return publicUrl;
      }
    } catch {
      await sleep(300);
    }
  }

  throw new Error("Timed out waiting for ngrok to publish a public URL.");
}

interface TunnelOutputWaitOptions {
  child: ChildProcess;
  exitMessage: string;
  matcher: RegExp;
  timeoutMessage: string;
  timeoutMs: number;
}

async function waitForTunnelUrlFromOutput(options: TunnelOutputWaitOptions): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let buffer = "";
    let settled = false;

    const finish = (error?: Error, url?: string) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutHandle);
      options.child.stdout?.off("data", onData);
      options.child.stderr?.off("data", onData);
      options.child.off("error", onError);
      options.child.off("exit", onExit);

      if (error) {
        reject(error);
        return;
      }

      resolve(url ?? "");
    };

    const onData = (chunk: string | Buffer) => {
      buffer += String(chunk);
      const match = buffer.match(options.matcher)?.[0];
      if (match) {
        finish(undefined, match);
      }
    };

    const onError = (error: Error) => {
      finish(error);
    };

    const onExit = () => {
      finish(new Error(options.exitMessage));
    };

    const timeoutHandle = setTimeout(() => {
      finish(new Error(options.timeoutMessage));
    }, options.timeoutMs);

    options.child.stdout?.on("data", onData);
    options.child.stderr?.on("data", onData);
    options.child.once("error", onError);
    options.child.once("exit", onExit);

    if (options.child.exitCode !== null) {
      finish(new Error(options.exitMessage));
    }
  });
}

function buildOriginUrl(options: StartTunnelOptions): string {
  const protocol = options.https ? "https" : "http";
  return `${protocol}://localhost:${options.port}`;
}

async function onceExit(child: ChildProcess, timeoutMs: number): Promise<void> {
  if (child.exitCode !== null) {
    return;
  }

  await Promise.race([
    new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
    }),
    sleep(timeoutMs).then(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    })
  ]);
}

function sleep(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
  });
}
