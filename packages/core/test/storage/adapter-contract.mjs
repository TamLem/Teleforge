import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { MemoryStorageAdapter } from "../../dist/index.js";

function createAdapter(options = {}) {
  return new MemoryStorageAdapter({
    defaultTTL: options.defaultTTL ?? 60,
    encryptionKey: options.encryptionKey,
    namespace: options.namespace
  });
}

function makeInstance(revision = 1, extra = {}) {
  return JSON.stringify({
    chatId: "1001",
    createdAt: Date.now(),
    currentSurface: "chat",
    expiresAt: Date.now() + 60_000,
    flowId: "test-flow",
    instanceId: "inst_test123",
    lastTransitionAt: Date.now(),
    revision,
    state: { step: "start" },
    status: "active",
    stepId: "start",
    userId: "user_42",
    ...extra
  });
}

test("contract: write and read instance snapshot", async () => {
  const adapter = createAdapter();
  const snapshot = makeInstance(1);

  await adapter.set("instance:inst_test123", snapshot);
  const retrieved = await adapter.get("instance:inst_test123");

  assert.ok(retrieved);
  assert.deepEqual(JSON.parse(retrieved), JSON.parse(snapshot));
});

test("contract: delete removes entry", async () => {
  const adapter = createAdapter();
  await adapter.set("instance:inst_test123", makeInstance(1));
  await adapter.delete("instance:inst_test123");
  assert.equal(await adapter.get("instance:inst_test123"), null);
});

test("contract: TTL expiry removes entry after timeout", async () => {
  const adapter = createAdapter({ defaultTTL: 0.03 });
  await adapter.set("instance:inst_test123", makeInstance(1), 0.03);
  assert.ok(await adapter.get("instance:inst_test123"));
  await delay(40);
  assert.equal(await adapter.get("instance:inst_test123"), null);
});

test("contract: touch extends entry TTL", async () => {
  const adapter = createAdapter({ defaultTTL: 60 });
  await adapter.set("instance:inst_test123", makeInstance(1));
  await adapter.touch("instance:inst_test123", 0.05);
  await delay(20);
  assert.ok(await adapter.get("instance:inst_test123"));
  await delay(40);
  assert.equal(await adapter.get("instance:inst_test123"), null);
});

test("contract: compareAndSet succeeds on matching revision", async () => {
  const adapter = createAdapter();
  await adapter.set("instance:inst_test123", makeInstance(1));
  const next = makeInstance(2);
  const result = await adapter.compareAndSet("instance:inst_test123", 1, next);
  assert.equal(result, true);
  const retrieved = await adapter.get("instance:inst_test123");
  assert.ok(retrieved);
  assert.equal(JSON.parse(retrieved).revision, 2);
});

test("contract: compareAndSet fails on stale revision", async () => {
  const adapter = createAdapter();
  await adapter.set("instance:inst_test123", makeInstance(2));
  const next = makeInstance(3);
  const result = await adapter.compareAndSet("instance:inst_test123", 1, next);
  assert.equal(result, false);
  const retrieved = await adapter.get("instance:inst_test123");
  assert.ok(retrieved);
  assert.equal(JSON.parse(retrieved).revision, 2);
});

test("contract: compareAndSet fails when key does not exist", async () => {
  const adapter = createAdapter();
  const result = await adapter.compareAndSet("instance:nonexistent", 1, makeInstance(2));
  assert.equal(result, false);
});

test("contract: compareAndSet fails when value is not valid JSON", async () => {
  const adapter = createAdapter();
  await adapter.set("instance:inst_test123", "not-json");
  const result = await adapter.compareAndSet("instance:inst_test123", 1, makeInstance(2));
  assert.equal(result, false);
});

test("scenario: concurrent update conflict — first writer wins, second loses", async () => {
  const adapter = createAdapter();
  await adapter.set("instance:inst_test123", makeInstance(1));

  const nextA = makeInstance(2, { state: { step: "A" } });
  const nextB = makeInstance(2, { state: { step: "B" } });

  const resultA = await adapter.compareAndSet("instance:inst_test123", 1, nextA);
  const resultB = await adapter.compareAndSet("instance:inst_test123", 1, nextB);

  assert.equal(resultA, true);
  assert.equal(resultB, false);

  const final = await adapter.get("instance:inst_test123");
  assert.ok(final);
  assert.equal(JSON.parse(final).state.step, "A");
});

test("contract: namespace isolation — keys in different namespaces do not collide", async () => {
  const adapterA = createAdapter({ namespace: "ns-a" });
  const adapterB = createAdapter({ namespace: "ns-b" });

  await adapterA.set("instance:inst_test123", makeInstance(1, { flowId: "flow-a" }));
  await adapterB.set("instance:inst_test123", makeInstance(1, { flowId: "flow-b" }));

  const fromA = await adapterA.get("instance:inst_test123");
  const fromB = await adapterB.get("instance:inst_test123");

  assert.ok(fromA);
  assert.ok(fromB);
  assert.equal(JSON.parse(fromA).flowId, "flow-a");
  assert.equal(JSON.parse(fromB).flowId, "flow-b");
});

test("contract: serialization/deserialization integrity — complex state survives round-trip", async () => {
  const adapter = createAdapter();
  const complexState = makeInstance(1, {
    state: {
      cart: [
        { id: "item-1", qty: 2, price: 9.99 },
        { id: "item-2", qty: 1, price: 19.99 }
      ],
      metadata: {
        source: "miniapp",
        timestamp: 1700000000000
      },
      nested: {
        a: { b: { c: "deep" } }
      }
    }
  });

  await adapter.set("instance:inst_complex", complexState);
  const retrieved = await adapter.get("instance:inst_complex");

  assert.ok(retrieved);
  const parsed = JSON.parse(retrieved);
  assert.deepEqual(parsed.state.cart[0], { id: "item-1", qty: 2, price: 9.99 });
  assert.equal(parsed.state.nested.a.b.c, "deep");
  assert.equal(parsed.state.metadata.timestamp, 1700000000000);
});

test("contract: get returns null for nonexistent key", async () => {
  const adapter = createAdapter();
  assert.equal(await adapter.get("nonexistent:key"), null);
});

test("contract: delete is idempotent — deleting nonexistent key does not throw", async () => {
  const adapter = createAdapter();
  await adapter.delete("nonexistent:key");
});

test("contract: set overwrites existing value", async () => {
  const adapter = createAdapter();
  await adapter.set("instance:inst_test123", makeInstance(1));
  await adapter.set("instance:inst_test123", makeInstance(5, { flowId: "overwritten" }));
  const retrieved = await adapter.get("instance:inst_test123");
  assert.ok(retrieved);
  assert.equal(JSON.parse(retrieved).revision, 5);
  assert.equal(JSON.parse(retrieved).flowId, "overwritten");
});

test("contract: encryption round-trip via encryptionKey option", async () => {
  const adapter = createAdapter({ encryptionKey: "secret-key", defaultTTL: 60 });
  const snapshot = makeInstance(1);

  await adapter.set("instance:inst_enc", snapshot);
  const retrieved = await adapter.get("instance:inst_enc");

  assert.ok(retrieved);
  assert.deepEqual(JSON.parse(retrieved), JSON.parse(snapshot));
});

test("contract: CAS with encryption preserves integrity", async () => {
  const adapter = createAdapter({ encryptionKey: "secret-key", defaultTTL: 60 });
  await adapter.set("instance:inst_enc", makeInstance(1));
  const next = makeInstance(2, { state: { updated: true } });
  const result = await adapter.compareAndSet("instance:inst_enc", 1, next);
  assert.equal(result, true);
  const retrieved = await adapter.get("instance:inst_enc");
  assert.ok(retrieved);
  assert.equal(JSON.parse(retrieved).state.updated, true);
});
