import { spawn, type ChildProcess } from "node:child_process";
import { accessSync, constants as fsConstants } from "node:fs";

import localtunnel from "localtunnel";

export type TunnelProvider = "localtunnel" | "ngrok";

export interface StartTunnelOptions {
  port: number;
  provider: TunnelProvider;
  subdomain?: string;
}

export interface TunnelHandle {
  provider: TunnelProvider;
  url: string;
  cleanup(): Promise<void>;
}

export async function startTunnel(options: StartTunnelOptions): Promise<TunnelHandle> {
  if (options.provider === "ngrok") {
    return startNgrokTunnel(options);
  }

  const tunnel = await localtunnel({
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

async function startNgrokTunnel(options: StartTunnelOptions): Promise<TunnelHandle> {
  accessSync("/usr/bin/env", fsConstants.X_OK);

  const args = ["http", String(options.port), "--log=stdout"];
  if (options.subdomain) {
    args.push("--domain", options.subdomain);
  }

  const child = spawn("ngrok", args, {
    stdio: ["ignore", "pipe", "pipe"]
  });

  const url = await waitForNgrokUrl(child);

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

async function waitForNgrokUrl(child: ChildProcess): Promise<string> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 15_000) {
    if (child.exitCode !== null) {
      throw new Error("ngrok exited before publishing a tunnel URL.");
    }

    try {
      const response = await fetch("http://127.0.0.1:4040/api/tunnels");
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

async function onceExit(child: ChildProcess, timeoutMs: number): Promise<void> {
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
