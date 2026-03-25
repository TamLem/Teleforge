import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import {
  createWebhookHandler,
  expressAdapter,
  fastifyAdapter,
  nodeHttpAdapter
} from "../dist/index.js";

test("createWebhookHandler routes valid updates to the runtime", async () => {
  const handled = [];
  const handler = createWebhookHandler(
    {
      async handle(update) {
        handled.push(update);
      }
    },
    {
      secretToken: "secret"
    }
  );
  const request = createWebhookRequest({
    headers: {
      "x-telegram-bot-api-secret-token": "secret"
    }
  });

  const result = await handler(request);

  assert.deepEqual(handled, [request.body]);
  assert.deepEqual(result, {
    ok: true,
    status: 200,
    updateId: 1
  });
});

test("createWebhookHandler rejects invalid secret tokens", async () => {
  const handler = createWebhookHandler(
    {
      async handle() {
        throw new Error("should not run");
      }
    },
    {
      secretToken: "expected"
    }
  );

  const result = await handler(
    createWebhookRequest({
      headers: {
        "x-telegram-bot-api-secret-token": "wrong"
      }
    })
  );

  assert.deepEqual(result, {
    description: "Invalid secret token.",
    ok: false,
    status: 401
  });
});

test("createWebhookHandler rejects unsupported methods", async () => {
  const handler = createWebhookHandler({
    async handle() {}
  });

  const result = await handler(
    createWebhookRequest({
      method: "GET"
    })
  );

  assert.deepEqual(result, {
    description: "Method not allowed.",
    ok: false,
    status: 405
  });
});

test("createWebhookHandler rejects malformed payloads", async () => {
  const handler = createWebhookHandler({
    async handle() {}
  });

  const result = await handler({
    body: "{bad-json",
    headers: {},
    method: "POST"
  });

  assert.deepEqual(result, {
    description: "Invalid update payload.",
    ok: false,
    status: 400
  });
});

test("createWebhookHandler converts runtime failures into 500 responses", async () => {
  const handler = createWebhookHandler({
    async handle() {
      throw new Error("boom");
    }
  });

  const result = await handler(createWebhookRequest());

  assert.deepEqual(result, {
    description: "boom",
    ok: false,
    status: 500,
    updateId: 1
  });
});

test("createWebhookHandler can ignore updates outside allowedUpdates", async () => {
  const handled = [];
  const handler = createWebhookHandler(
    {
      async handle(update) {
        handled.push(update);
      }
    },
    {
      allowedUpdates: ["callback_query"]
    }
  );

  const result = await handler(createWebhookRequest());

  assert.deepEqual(handled, []);
  assert.deepEqual(result, {
    description: "Update ignored by allowedUpdates filter.",
    ok: true,
    status: 200,
    updateId: 1
  });
});

test("expressAdapter adapts webhook results to Express-style response objects", async () => {
  const handled = [];
  const adapter = expressAdapter({
    async handle(update) {
      handled.push(update);
    }
  });
  const responseState = {
    body: null,
    statusCode: 200
  };

  await adapter(
    {
      body: createUpdate(),
      headers: {},
      method: "POST"
    },
    {
      json(body) {
        responseState.body = body;
      },
      status(statusCode) {
        responseState.statusCode = statusCode;
        return this;
      }
    }
  );

  assert.deepEqual(handled, [createUpdate()]);
  assert.equal(responseState.statusCode, 200);
  assert.deepEqual(responseState.body, {
    ok: true,
    status: 200,
    updateId: 1
  });
});

test("fastifyAdapter adapts webhook results to Fastify-style reply objects", async () => {
  const handled = [];
  const adapter = fastifyAdapter({
    async handle(update) {
      handled.push(update);
    }
  });
  const replyState = {
    body: null,
    statusCode: 200
  };

  await adapter(
    {
      body: createUpdate(),
      headers: {},
      method: "POST"
    },
    {
      code(statusCode) {
        replyState.statusCode = statusCode;
        return this;
      },
      send(body) {
        replyState.body = body;
      }
    }
  );

  assert.deepEqual(handled, [createUpdate()]);
  assert.equal(replyState.statusCode, 200);
  assert.deepEqual(replyState.body, {
    ok: true,
    status: 200,
    updateId: 1
  });
});

test("nodeHttpAdapter handles raw HTTP requests", async () => {
  const handled = [];
  const server = http.createServer(
    nodeHttpAdapter({
      async handle(update) {
        handled.push(update);
      }
    })
  );

  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();

  assert.notEqual(address, null);
  assert.equal(typeof address, "object");

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/webhook`, {
      body: JSON.stringify(createUpdate()),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      status: 200,
      updateId: 1
    });
    assert.deepEqual(handled, [createUpdate()]);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});

function createWebhookRequest(overrides = {}) {
  return {
    body: createUpdate(),
    headers: {},
    method: "POST",
    ...overrides
  };
}

function createUpdate() {
  return {
    message: {
      chat: {
        id: 1001,
        type: "private"
      },
      from: {
        first_name: "Dev",
        id: 42
      },
      message_id: 1,
      text: "/start"
    },
    update_id: 1
  };
}
