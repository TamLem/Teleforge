import assert from "node:assert/strict";
import test from "node:test";

import {
  createSignedActionContext,
  validateActionContext,
  verifySignedActionContext,
  decodeActionContextToken
} from "../dist/index.js";

const SECRET = "test-secret-123";

test("createSignedActionContext produces tfp2 token", () => {
  const token = createSignedActionContext(
    {
      appId: "test-app",
      flowId: "test-flow",
      screenId: "test-screen",
      userId: "user-1",
      subject: { key: "value" },
      allowedActions: ["action1", "action2"],
      issuedAt: 1000,
      expiresAt: 2000
    },
    SECRET
  );

  assert.ok(token.startsWith("tfp2."));
  assert.equal(token.split(".").length, 3);
});

test("verifySignedActionContext validates correct token", () => {
  const token = createSignedActionContext(
    {
      appId: "test-app",
      flowId: "test-flow",
      userId: "user-1",
      issuedAt: 1000,
      expiresAt: Date.now() / 1000 + 900
    },
    SECRET
  );

  const ctx = verifySignedActionContext(token, SECRET);
  assert.ok(ctx);
  assert.equal(ctx.appId, "test-app");
  assert.equal(ctx.flowId, "test-flow");
  assert.equal(ctx.userId, "user-1");
});

test("verifySignedActionContext rejects wrong secret", () => {
  const token = createSignedActionContext(
    {
      appId: "test-app",
      flowId: "test-flow",
      userId: "user-1",
      issuedAt: 1000,
      expiresAt: 2000
    },
    SECRET
  );

  const ctx = verifySignedActionContext(token, "wrong-secret");
  assert.equal(ctx, null);
});

test("verifySignedActionContext rejects tampered payload", () => {
  const token = createSignedActionContext(
    {
      appId: "test-app",
      flowId: "test-flow",
      userId: "user-1",
      issuedAt: 1000,
      expiresAt: 2000
    },
    SECRET
  );

  const [prefix, payload, sig] = token.split(".");
  const tampered = `${prefix}.${payload}.${sig.replace(/a/g, "b")}`;
  const ctx = verifySignedActionContext(tampered, SECRET);
  assert.equal(ctx, null);
});

test("verifySignedActionContext rejects wrong prefix", () => {
  const token = createSignedActionContext(
    {
      appId: "test-app",
      flowId: "test-flow",
      userId: "user-1",
      issuedAt: 1000,
      expiresAt: 2000
    },
    SECRET
  );

  const [, payload, sig] = token.split(".");
  const ctx = verifySignedActionContext(`tfp1.${payload}.${sig}`, SECRET);
  assert.equal(ctx, null);
});

test("validateActionContext checks expiry", () => {
  const token = createSignedActionContext(
    {
      appId: "test-app",
      flowId: "test-flow",
      userId: "user-1",
      issuedAt: 1000,
      expiresAt: 1001 // expired
    },
    SECRET
  );

  const ctx = validateActionContext(token, SECRET);
  assert.equal(ctx, null);
});

test("validateActionContext checks flowId", () => {
  const token = createSignedActionContext(
    {
      appId: "test-app",
      flowId: "test-flow",
      userId: "user-1",
      issuedAt: 1000,
      expiresAt: Date.now() / 1000 + 900
    },
    SECRET
  );

  const ctx = validateActionContext(token, SECRET, { flowId: "wrong-flow" });
  assert.equal(ctx, null);
});

test("validateActionContext checks allowedAction", () => {
  const token = createSignedActionContext(
    {
      appId: "test-app",
      flowId: "test-flow",
      userId: "user-1",
      allowedActions: ["action1"],
      issuedAt: 1000,
      expiresAt: Date.now() / 1000 + 900
    },
    SECRET
  );

  const ctx = validateActionContext(token, SECRET, { allowedAction: "action2" });
  assert.equal(ctx, null);
});

test("validateActionContext passes with all checks", () => {
  const token = createSignedActionContext(
    {
      appId: "test-app",
      flowId: "test-flow",
      userId: "user-1",
      allowedActions: ["action1", "action2"],
      issuedAt: 1000,
      expiresAt: Date.now() / 1000 + 900
    },
    SECRET
  );

  const ctx = validateActionContext(token, SECRET, {
    flowId: "test-flow",
    allowedAction: "action1"
  });
  assert.ok(ctx);
  assert.deepStrictEqual(ctx.allowedActions, ["action1", "action2"]);
});

test("decodeActionContextToken returns subject", () => {
  const token = createSignedActionContext(
    {
      appId: "test-app",
      flowId: "test-flow",
      userId: "user-1",
      subject: { products: [1, 2, 3] },
      issuedAt: 1000,
      expiresAt: 2000
    },
    SECRET
  );

  const ctx = decodeActionContextToken(token);
  assert.ok(ctx);
  assert.deepStrictEqual(ctx.subject, { products: [1, 2, 3] });
});

test("createSignedActionContext requires secret", () => {
  assert.throws(() => {
    createSignedActionContext(
      {
        appId: "test-app",
        flowId: "test-flow",
        userId: "user-1",
        issuedAt: 1000,
        expiresAt: 2000
      },
      ""
    );
  });
});
