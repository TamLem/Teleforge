import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { MemoryStorageAdapter } from "../../dist/index.js";

test("MemoryStorageAdapter stores, touches, and expires state", async () => {
  const adapter = new MemoryStorageAdapter({
    defaultTTL: 0.02,
    namespace: "test"
  });
  const state = {
    createdAt: Date.now(),
    expiresAt: Date.now() + 20,
    flowId: "task-shop",
    payload: {},
    stepId: "catalog",
    userId: "1",
    version: 1
  };

  await adapter.set("flow:key", state);
  assert.equal((await adapter.get("flow:key"))?.flowId, "task-shop");

  await delay(10);
  await adapter.touch("flow:key", 0.04);
  await delay(20);

  assert.equal((await adapter.get("flow:key"))?.stepId, "catalog");

  await delay(30);
  assert.equal(await adapter.get("flow:key"), null);
});

test("MemoryStorageAdapter supports compareAndSet and optional encryption", async () => {
  const adapter = new MemoryStorageAdapter({
    defaultTTL: 30,
    encryptionKey: "coord-secret"
  });
  const state = {
    createdAt: Date.now(),
    expiresAt: Date.now() + 30_000,
    flowId: "task-shop",
    payload: {
      count: 1
    },
    stepId: "catalog",
    userId: "1",
    version: 1
  };

  await adapter.set("flow:key", state);
  const updated = await adapter.compareAndSet("flow:key", 1, {
    ...state,
    payload: {
      count: 2
    },
    version: 2
  });

  assert.equal(updated, true);
  assert.equal((await adapter.get("flow:key"))?.payload.count, 2);
  assert.equal(
    await adapter.compareAndSet("flow:key", 1, {
      ...state,
      version: 3
    }),
    false
  );
});
