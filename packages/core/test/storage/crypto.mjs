import assert from "node:assert/strict";
import test from "node:test";

import { decryptState, encryptState } from "../../dist/index.js";

const sampleState = {
  chatId: "1001",
  createdAt: 1,
  currentSurface: "chat",
  expiresAt: 2,
  flowId: "task-shop",
  instanceId: "inst_test",
  lastTransitionAt: 1,
  revision: 1,
  state: {
    source: "start"
  },
  status: "active",
  stepId: "catalog",
  userId: "42"
};

test("encryptState and decryptState round-trip a flow state", () => {
  const encrypted = encryptState(sampleState, "coord-secret");
  const decrypted = decryptState(encrypted, "coord-secret");

  assert.equal(encrypted.algorithm, "aes-256-gcm");
  assert.equal(encrypted.version, 1);
  assert.deepEqual(decrypted, sampleState);
});

test("decryptState rejects the wrong encryption key", () => {
  const encrypted = encryptState(sampleState, "coord-secret");

  assert.throws(() => decryptState(encrypted, "other-secret"));
});
