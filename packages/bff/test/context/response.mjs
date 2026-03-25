import assert from "node:assert/strict";
import test from "node:test";

import { createBffRequestContext } from "../../dist/index.js";

test("context.toResponse serializes JSON responses with status, headers, and cookies", async () => {
  const context = await createBffRequestContext(new Request("https://example.com/api/items"), {
    generateRequestId: () => "req-fixed",
    validateInitData: false
  });

  context.response.status = 201;
  context.response.body = {
    id: "item-1"
  };
  context.response.headers.set("x-request-id", context.id);
  context.response.cookies.set("session", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    value: "abc123"
  });

  const response = context.toResponse();

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("x-request-id"), "req-fixed");
  assert.match(response.headers.get("set-cookie") ?? "", /session=abc123/);
  assert.deepEqual(await response.json(), {
    id: "item-1"
  });
});
