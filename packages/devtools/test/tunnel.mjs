import test from "node:test";
import assert from "node:assert/strict";

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
