import assert from "node:assert/strict";
import test from "node:test";

import { createBffConfig, defineBffRoute } from "../../dist/index.js";
import { createIdentityAdapter, createMemorySessionAdapter } from "../helpers/session.mjs";

test("mountBuiltIns skips session routes when sessions are disabled", () => {
  const config = createBffConfig({
    botToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    features: {
      sessions: false
    },
    identity: {
      adapter: createIdentityAdapter()
    }
  });
  const router = config.createRouter();

  router.mountBuiltIns();

  assert.equal(router.getAll().length, 0);
});

test("mountBuiltIns registers built-in session routes when enabled", () => {
  const config = createBffConfig({
    adapters: {
      session: createMemorySessionAdapter()
    },
    botToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    identity: {
      adapter: createIdentityAdapter()
    },
    jwt: {
      secret: "teleforge-jwt-secret"
    }
  });
  const router = config.createRouter();

  router.mountBuiltIns();

  assert.deepEqual(
    router
      .getAll()
      .map((route) => route.config.path)
      .sort(),
    ["/exchange", "/refresh", "/revoke"]
  );
});

test("createHandler processes matched JSON requests through the BFF pipeline", async () => {
  const config = createBffConfig({
    botToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    features: {
      sessions: false
    },
    identity: {
      adapter: createIdentityAdapter()
    }
  });
  const router = config.createRouter();

  router.add(
    defineBffRoute({
      auth: "public",
      completion(_context, result) {
        return {
          chatId: 9,
          text: `Saved ${result.message}`,
          type: "sendMessage"
        };
      },
      async handler(_context, input) {
        return {
          message: input.message.toUpperCase()
        };
      },
      method: "POST",
      path: "/echo"
    })
  );

  const handler = router.createHandler();
  const response = await handler(
    new Request("https://example.com/echo", {
      body: JSON.stringify({
        message: "teleforge"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id") !== null, true);
  assert.deepEqual(payload, {
    completion: {
      action: {
        chatId: 9,
        text: "Saved TELEFORGE",
        type: "sendMessage"
      },
      version: "1.0"
    },
    data: {
      message: "TELEFORGE"
    }
  });
});

test("createHandler resolves configured services for service routes", async () => {
  const config = createBffConfig({
    botToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    features: {
      completion: false,
      sessions: false
    },
    identity: {
      adapter: createIdentityAdapter()
    },
    services: {
      users: {
        config: {
          baseUrl: "https://services.example.com"
        },
        async invoke(operation, input, context) {
          assert.equal(operation, "lookup");
          assert.deepEqual(input, {
            userId: "42"
          });
          assert.equal(context.requestId.length > 0, true);
          assert.equal(context.headers["x-request-id"]?.length > 0, true);

          return {
            fullName: "Ada Lovelace"
          };
        },
        name: "users"
      }
    }
  });
  const router = config.createRouter();

  router.add(
    defineBffRoute({
      auth: "public",
      method: "POST",
      path: "/users/lookup",
      service: {
        name: "users",
        operation: "lookup",
        transformOutput(_context, output) {
          return {
            name: output.fullName
          };
        }
      }
    })
  );

  const handler = router.createHandler();
  const response = await handler(
    new Request("https://example.com/users/lookup", {
      body: JSON.stringify({
        userId: "42"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload, {
    data: {
      name: "Ada Lovelace"
    }
  });
});
