import assert from "node:assert/strict";
import test from "node:test";

import { BffRouteRegistry, defineBffRoute } from "../../dist/index.js";

test("BffRouteRegistry matches routes by method and path params", () => {
  const registry = new BffRouteRegistry();
  const route = defineBffRoute({
    auth: "public",
    handler() {
      return { ok: true };
    },
    method: "GET",
    path: "/users/:id"
  });

  registry.register(route);

  const match = registry.match("GET", "/users/42");

  assert.equal(match?.route, route);
  assert.deepEqual(match?.params, {
    id: "42"
  });
});

test("BffRouteRegistry returns null for unmatched routes", () => {
  const registry = new BffRouteRegistry();

  registry.register(
    defineBffRoute({
      auth: "public",
      handler() {
        return { ok: true };
      },
      method: "GET",
      path: "/users/:id"
    })
  );

  assert.equal(registry.match("POST", "/users/42"), null);
  assert.equal(registry.match("GET", "/projects/42"), null);
});
