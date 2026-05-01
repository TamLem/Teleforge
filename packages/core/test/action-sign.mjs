import assert from "node:assert/strict";
import test from "node:test";
import { createSignedActionContext, validateActionContext } from "../dist/index.js";

const SECRET = "test-secret-123";

test("sign in action handlers can omit flowId — inferred from ctx", () => {
  const token = createSignedActionContext(
    {
      appId: "my-app",
      flowId: "shop",
      screenId: "tracking",
      userId: "user-1",
      subject: { resource: { type: "order", id: "ORD-1" } },
      allowedActions: ["loadOrder"],
      issuedAt: 1000,
      expiresAt: Date.now() / 1000 + 900
    },
    SECRET
  );

  const ctx = validateActionContext(token, SECRET, { flowId: "shop", allowedAction: "loadOrder" });
  assert.ok(ctx);
  assert.equal(ctx.flowId, "shop");
  assert.equal(ctx.screenId, "tracking");
  assert.deepStrictEqual(ctx.subject, { resource: { type: "order", id: "ORD-1" } });
});

test("sign produces valid token when flowId is provided in params", () => {
  const token = createSignedActionContext(
    {
      appId: "my-app",
      flowId: "override-flow",
      screenId: "catalog",
      userId: "user-1",
      issuedAt: 1000,
      expiresAt: Date.now() / 1000 + 900
    },
    SECRET
  );

  const ctx = validateActionContext(token, SECRET, { flowId: "override-flow" });
  assert.ok(ctx);
  assert.equal(ctx.flowId, "override-flow");
});

test("SignActionContextParams accept flowId as optional", async () => {
  // This mirrors the DX: sign({ screenId, subject, allowedActions })
  // flowId is optional — the implementation fills it from ctx.flowId
  const token = createSignedActionContext(
    {
      appId: "my-app",
      flowId: "ctx-flow",
      screenId: "catalog",
      userId: "user-1",
      subject: { catalogId: "main" },
      issuedAt: 1000,
      expiresAt: Date.now() / 1000 + 900
    },
    SECRET
  );

  const ctx = validateActionContext(token, SECRET);
  assert.ok(ctx);
  assert.equal(ctx.flowId, "ctx-flow");
});
