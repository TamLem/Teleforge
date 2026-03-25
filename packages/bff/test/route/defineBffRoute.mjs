import assert from "node:assert/strict";
import test from "node:test";

import { BffRouteError, defineBffRoute, executeBffRoute } from "../../dist/index.js";

test("defineBffRoute preserves typed handler routes", async () => {
  const route = defineBffRoute({
    auth: "public",
    async handler(_context, input) {
      return {
        message: `hello ${input.name}`
      };
    },
    method: "POST",
    path: "/hello"
  });

  const result = await executeBffRoute(
    route,
    {
      headers: new Headers(),
      launchMode: "compact",
      method: "POST",
      path: "/hello",
      searchParams: new URLSearchParams(),
      setHeader() {},
      setStatus() {}
    },
    { name: "Teleforge" }
  );

  assert.equal(result.message, "hello Teleforge");
});

test("defineBffRoute throws when neither handler nor proxy is provided", () => {
  assert.throws(
    () =>
      defineBffRoute({
        auth: "public",
        method: "GET",
        path: "/missing"
      }),
    (error) => error instanceof BffRouteError && error.code === "MISSING_HANDLER"
  );
});

test("defineBffRoute throws when both handler and proxy are provided", () => {
  assert.throws(
    () =>
      defineBffRoute({
        auth: "public",
        handler() {
          return { ok: true };
        },
        method: "GET",
        path: "/duplicate",
        proxy: {
          action: "get",
          service: "users"
        }
      }),
    (error) => error instanceof BffRouteError && error.code === "DUPLICATE_HANDLER"
  );
});
