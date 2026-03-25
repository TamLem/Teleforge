import assert from "node:assert/strict";
import test from "node:test";

import { BffContextError, createBffRequestContext } from "../../dist/index.js";

test("context.json parses a JSON request body and caches it on context.body", async () => {
  const request = new Request("https://example.com/api/orders", {
    body: JSON.stringify({
      itemId: "task-001",
      quantity: 2
    }),
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });
  const context = await createBffRequestContext(request, {
    validateInitData: false
  });

  const payload = await context.json();

  assert.deepEqual(payload, {
    itemId: "task-001",
    quantity: 2
  });
  assert.deepEqual(context.body, payload);
});

test("context.json throws MALFORMED_BODY for invalid JSON", async () => {
  const request = new Request("https://example.com/api/orders", {
    body: "{invalid",
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });
  const context = await createBffRequestContext(request, {
    validateInitData: false
  });

  await assert.rejects(
    () => context.json(),
    (error) => error instanceof BffContextError && error.code === "MALFORMED_BODY"
  );
});

test("context.text and context.arrayBuffer expose raw request bodies", async () => {
  const request = new Request("https://example.com/api/upload", {
    body: "hello world",
    method: "POST"
  });
  const context = await createBffRequestContext(request, {
    validateInitData: false
  });

  const text = await context.text();
  const bytes = await context.arrayBuffer();

  assert.equal(text, "hello world");
  assert.equal(new TextDecoder().decode(new Uint8Array(bytes)), "hello world");
});
