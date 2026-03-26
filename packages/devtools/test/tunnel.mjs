import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { startTunnel } from "../dist/utils/tunnel.js";

test("localtunnel receives the resolved runtime port and HTTPS flags", async () => {
  let receivedOptions;
  let closed = false;

  const handle = await startTunnel(
    {
      https: true,
      port: 45123,
      provider: "localtunnel",
      subdomain: "demo-subdomain"
    },
    {
      createLocaltunnel: async (options) => {
        receivedOptions = options;
        return {
          async close() {
            closed = true;
          },
          url: "https://demo-subdomain.loca.lt"
        };
      }
    }
  );

  assert.deepEqual(receivedOptions, {
    allow_invalid_cert: true,
    local_https: true,
    port: 45123,
    subdomain: "demo-subdomain"
  });
  assert.equal(handle.provider, "localtunnel");
  assert.equal(handle.url, "https://demo-subdomain.loca.lt");

  await handle.cleanup();
  assert.equal(closed, true);
});

test("cloudflare quick tunnels receive the resolved HTTPS origin URL", async () => {
  const child = createMockChildProcess();
  const spawnCalls = [];

  queueMicrotask(() => {
    child.stderr.write("INF | Your quick Tunnel has been created! Visit it at https://demo.trycloudflare.com\n");
  });

  const handle = await startTunnel(
    {
      https: true,
      port: 45124,
      provider: "cloudflare"
    },
    {
      spawnProcess(command, args) {
        spawnCalls.push({ args, command });
        return child;
      }
    }
  );

  assert.deepEqual(spawnCalls, [
    {
      args: [
        "tunnel",
        "--url",
        "https://localhost:45124",
        "--loglevel",
        "info",
        "--no-tls-verify"
      ],
      command: "cloudflared"
    }
  ]);
  assert.equal(handle.provider, "cloudflare");
  assert.equal(handle.url, "https://demo.trycloudflare.com");

  await handle.cleanup();
  assert.equal(child.killed, true);
});

test("cloudflare quick tunnels reject unsupported subdomains", async () => {
  await assert.rejects(
    startTunnel({
      https: true,
      port: 45125,
      provider: "cloudflare",
      subdomain: "not-supported"
    }),
    /Cloudflare quick tunnels do not support --subdomain/
  );
});

function createMockChildProcess() {
  class MockChildProcess extends EventEmitter {
    constructor() {
      super();
      this.exitCode = null;
      this.killed = false;
      this.stdout = new PassThrough();
      this.stderr = new PassThrough();
    }

    kill() {
      this.killed = true;
      this.exitCode = 0;
      this.emit("exit", 0);
      return true;
    }
  }

  return new MockChildProcess();
}
