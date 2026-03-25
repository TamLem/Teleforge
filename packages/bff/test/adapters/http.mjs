import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { HttpServiceAdapter } from "../../dist/index.js";

test("HttpServiceAdapter invokes JSON services and propagates trace headers", async () => {
  await withServer(
    async (request, response) => {
      assert.equal(request.method, "GET");
      assert.equal(request.headers["x-request-id"], "req-1");
      assert.equal(request.headers["x-trace-id"], "trace-1");

      response.writeHead(200, {
        "content-type": "application/json"
      });
      response.end(JSON.stringify({ id: "123", ok: true }));
    },
    async (baseUrl) => {
      const adapter = new HttpServiceAdapter("users", {
        baseUrl
      });
      const result = await adapter.invoke("GET /users/123", undefined, {
        headers: {
          "x-request-id": "req-1",
          "x-trace-id": "trace-1"
        },
        requestId: "req-1",
        traceId: "trace-1"
      });

      assert.deepEqual(result, {
        id: "123",
        ok: true
      });
    }
  );
});

test("HttpServiceAdapter maps timeout failures to SERVICE_TIMEOUT", async () => {
  await withServer(
    async (_request, response) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      response.writeHead(200, {
        "content-type": "application/json"
      });
      response.end(JSON.stringify({ ok: true }));
    },
    async (baseUrl) => {
      const adapter = new HttpServiceAdapter("users", {
        baseUrl,
        timeout: 10
      });

      await assert.rejects(
        () =>
          adapter.invoke("GET /users/slow", undefined, {
            headers: {},
            requestId: "req-timeout"
          }),
        (error) => error?.code === "SERVICE_TIMEOUT"
      );
    }
  );
});

test("HttpServiceAdapter maps downstream 5xx responses to SERVICE_UNAVAILABLE", async () => {
  await withServer(
    async (_request, response) => {
      response.writeHead(503, {
        "content-type": "application/json"
      });
      response.end(JSON.stringify({ error: "unavailable" }));
    },
    async (baseUrl) => {
      const adapter = new HttpServiceAdapter("users", {
        baseUrl
      });

      await assert.rejects(
        () =>
          adapter.invoke("GET /users/503", undefined, {
            headers: {},
            requestId: "req-503"
          }),
        (error) => error?.code === "SERVICE_UNAVAILABLE"
      );
    }
  );
});

async function withServer(handler, run) {
  const server = createServer((request, response) => {
    Promise.resolve(handler(request, response)).catch((error) => {
      response.writeHead(500, {
        "content-type": "text/plain"
      });
      response.end(error instanceof Error ? error.message : "server error");
    });
  });

  await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(undefined);
    });
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address.");
  }

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(undefined);
      });
    });
  }
}
