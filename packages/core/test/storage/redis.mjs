import assert from "node:assert/strict";
import test from "node:test";

import { RedisStorageAdapter } from "../../dist/index.js";

class FakeRedisClient {
  store = new Map();

  async del(key) {
    this.store.delete(key);
  }

  async eval(_script, options) {
    const [key] = options.keys;
    const [expectedRevision, value] = options.arguments;
    const current = this.store.get(key);

    if (!current) {
      return 0;
    }

    if (JSON.parse(current).revision !== Number(expectedRevision)) {
      return 0;
    }

    this.store.set(key, value);
    return 1;
  }

  async expire() {}

  async get(key) {
    return this.store.get(key) ?? null;
  }

  async set(key, value) {
    this.store.set(key, value);
  }
}

test("RedisStorageAdapter delegates storage operations to a Redis-like client", async () => {
  const client = new FakeRedisClient();
  const adapter = new RedisStorageAdapter({
    client,
    defaultTTL: 60,
    namespace: "app"
  });

  await adapter.set("flow:user:start", JSON.stringify({ revision: 1, state: { ok: true } }));

  assert.equal(
    await adapter.get("flow:user:start"),
    JSON.stringify({ revision: 1, state: { ok: true } })
  );
  assert.equal(
    await adapter.compareAndSet(
      "flow:user:start",
      1,
      JSON.stringify({ revision: 2, state: { ok: false } })
    ),
    true
  );
  assert.equal(
    await adapter.compareAndSet(
      "flow:user:start",
      1,
      JSON.stringify({ revision: 3, state: { ok: false } })
    ),
    false
  );
  assert.equal(client.store.has("app:flow:user:start"), true);

  await adapter.delete("flow:user:start");
  assert.equal(await adapter.get("flow:user:start"), null);
});
