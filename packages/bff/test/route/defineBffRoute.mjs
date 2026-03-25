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

test("executeBffRoute invokes service routes through invokeService", async () => {
  const route = defineBffRoute({
    auth: "public",
    method: "POST",
    path: "/users",
    service: {
      name: "user-service",
      operation: "getUser",
      transformInput(_context, input) {
        return {
          id: input.userId
        };
      },
      transformOutput(_context, output) {
        return {
          name: output.fullName
        };
      }
    }
  });
  const result = await executeBffRoute(
    route,
    {
      header() {
        return null;
      },
      headers: new Headers(),
      launchMode: "compact",
      method: "POST",
      path: "/users",
      searchParams: new URLSearchParams(),
      setHeader() {},
      setStatus() {}
    },
    { userId: "42" },
    {
      async invokeService(service, _context, input) {
        assert.equal(service.name, "user-service");
        assert.equal(service.operation, "getUser");
        assert.deepEqual(input, {
          id: "42"
        });

        return {
          fullName: "Ada Lovelace"
        };
      }
    }
  );

  assert.deepEqual(result, {
    name: "Ada Lovelace"
  });
});

test("executeBffRoute preserves proxy alias compatibility via invokeService", async () => {
  const route = defineBffRoute({
    auth: "public",
    method: "POST",
    path: "/legacy-users",
    proxy: {
      action: "getUser",
      service: "user-service",
      transform: {
        request(_context, input) {
          return {
            id: input.userId
          };
        },
        response(_context, output) {
          return {
            name: output.fullName
          };
        }
      }
    }
  });
  const result = await executeBffRoute(
    route,
    {
      header() {
        return null;
      },
      headers: new Headers(),
      launchMode: "compact",
      method: "POST",
      path: "/legacy-users",
      searchParams: new URLSearchParams(),
      setHeader() {},
      setStatus() {}
    },
    { userId: "7" },
    {
      async invokeService(service, _context, input) {
        assert.equal(service.name, "user-service");
        assert.equal(service.operation, "getUser");
        assert.deepEqual(input, {
          id: "7"
        });

        return {
          fullName: "Grace Hopper"
        };
      }
    }
  );

  assert.deepEqual(result, {
    name: "Grace Hopper"
  });
});
