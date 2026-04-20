import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { MemoryStorageAdapter } from "../../dist/index.js";

test("MemoryStorageAdapter stores, touches, and expires state", async () => {
  const adapter = new MemoryStorageAdapter({
    defaultTTL: 0.02,
    namespace: "test"
  });
  const state = JSON.stringify({
    createdAt: Date.now(),
    expiresAt: Date.now() + 20,
    flowId: "task-shop",
    instanceId: "inst_test",
    revision: 1,
    state: {},
    status: "active",
    stepId: "catalog",
    userId: "1"
  });

  await adapter.set("flow:key", state);
  const raw = await adapter.get("flow:key");
  assert.ok(raw);
  assert.equal(JSON.parse(raw).flowId, "task-shop");

  await delay(10);
  await adapter.touch("flow:key", 0.04);
  await delay(20);

  const touched = await adapter.get("flow:key");
  assert.ok(touched);
  assert.equal(JSON.parse(touched).stepId, "catalog");

  await delay(30);
  assert.equal(await adapter.get("flow:key"), null);
});

test("MemoryStorageAdapter supports compareAndSet and optional encryption", async () => {
  const adapter = new MemoryStorageAdapter({
    defaultTTL: 30,
    encryptionKey: "coord-secret"
  });
  const state = JSON.stringify({
    createdAt: Date.now(),
    expiresAt: Date.now() + 30_000,
    flowId: "task-shop",
    instanceId: "inst_test",
    revision: 1,
    state: {
      count: 1
    },
    status: "active",
    stepId: "catalog",
    userId: "1"
  });

  await adapter.set("flow:key", state);
  const updated = JSON.stringify({
    createdAt: Date.now(),
    expiresAt: Date.now() + 30_000,
    flowId: "task-shop",
    instanceId: "inst_test",
    revision: 2,
    state: {
      count: 2
    },
    status: "active",
    stepId: "catalog",
    userId: "1"
  });
  const casResult = await adapter.compareAndSet("flow:key", 1, updated);

  assert.equal(casResult, true);
  const retrieved = await adapter.get("flow:key");
  assert.ok(retrieved);
  assert.equal(JSON.parse(retrieved).state.count, 2);

  const staleUpdate = JSON.stringify({
    ...JSON.parse(retrieved),
    revision: 3,
    state: { count: 3 }
  });
  assert.equal(
    await adapter.compareAndSet("flow:key", 1, staleUpdate),
    false
  );
});
