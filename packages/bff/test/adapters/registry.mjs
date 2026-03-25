import assert from "node:assert/strict";
import test from "node:test";

import { ServiceAdapterRegistry } from "../../dist/index.js";

test("ServiceAdapterRegistry registers and looks up adapters by name", () => {
  const registry = new ServiceAdapterRegistry();
  const adapter = {
    config: {
      baseUrl: "https://services.example.com"
    },
    async invoke(operation, input) {
      return {
        input,
        operation
      };
    },
    name: "users"
  };

  registry.register(adapter);

  assert.equal(registry.has("users"), true);
  assert.equal(registry.get("users"), adapter);
  assert.deepEqual(registry.list(), ["users"]);
});
