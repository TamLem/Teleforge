import assert from "node:assert/strict";
import test from "node:test";

import { UserFlowStateManager, createFlowStorage } from "../../dist/index.js";

function createManager(options = {}) {
  return new UserFlowStateManager(
    createFlowStorage({
      backend: "memory",
      defaultTTL: options.defaultTTL ?? 60,
      namespace: options.namespace ?? "workflow-test"
    })
  );
}

test("workflow: startInstance creates instance and state key", async () => {
  const manager = createManager();
  const { instanceId, key } = await manager.startInstance(
    "user_1",
    "order-flow",
    "browse",
    { source: "start" },
    "chat_42"
  );

  assert.match(instanceId, /^inst_/);
  assert.match(key, /^instance:/);

  const instance = await manager.getInstance(key);
  assert.ok(instance);
  assert.equal(instance.instanceId, instanceId);
  assert.equal(instance.flowId, "order-flow");
  assert.equal(instance.userId, "user_1");
  assert.equal(instance.stepId, "browse");
  assert.equal(instance.status, "active");
  assert.equal(instance.revision, 1);
  assert.equal(instance.currentSurface, "chat");
  assert.equal(instance.chatId, "chat_42");
  assert.deepEqual(instance.state, { source: "start" });
});

test("workflow: startInstance writes to both instance key and state key", async () => {
  const manager = createManager();
  const { instanceId: _instanceId, key } = await manager.startInstance(
    "user_1",
    "order-flow",
    "browse",
    { source: "start" }
  );

  const stateKey = manager.createStateKey("user_1", "order-flow");
  const fromInstance = await manager.getInstance(key);
  const fromState = await manager.getInstance(stateKey);

  assert.ok(fromInstance);
  assert.ok(fromState);
  assert.equal(fromInstance.instanceId, fromState.instanceId);
  assert.equal(fromInstance.revision, fromState.revision);
});

test("workflow: resumeFlow returns instance via state key", async () => {
  const manager = createManager();
  await manager.startInstance("user_1", "order-flow", "browse");
  const resumed = await manager.resumeFlow("user_1", "order-flow");

  assert.ok(resumed);
  assert.equal(resumed.flowId, "order-flow");
  assert.equal(resumed.userId, "user_1");
  assert.equal(resumed.status, "active");
});

test("workflow: resumeFlow returns null for nonexistent flow", async () => {
  const manager = createManager();
  const result = await manager.resumeFlow("user_999", "nonexistent");
  assert.equal(result, null);
});

test("workflow: advanceStep increments revision and merges state", async () => {
  const manager = createManager();
  const { key } = await manager.startInstance("user_1", "order-flow", "browse", {
    items: []
  });

  const step2 = await manager.advanceStep(key, "cart", { items: ["item-1"] });
  assert.equal(step2.stepId, "cart");
  assert.equal(step2.revision, 2);
  assert.deepEqual(step2.state, { items: ["item-1"] });

  const step3 = await manager.advanceStep(key, "checkout", { items: ["item-1"], total: 50 });
  assert.equal(step3.stepId, "checkout");
  assert.equal(step3.revision, 3);
  assert.deepEqual(step3.state, { items: ["item-1"], total: 50 });

  const persisted = await manager.getInstance(key);
  assert.ok(persisted);
  assert.equal(persisted.revision, 3);
  assert.equal(persisted.stepId, "checkout");
});

test("workflow: advanceStep updates surface and waitReason", async () => {
  const manager = createManager();
  const { key } = await manager.startInstance("user_1", "order-flow", "browse");

  const miniappStep = await manager.advanceStep(key, "catalog", {}, "miniapp", "userInput");
  assert.equal(miniappStep.currentSurface, "miniapp");
  assert.equal(miniappStep.waitReason, "userInput");

  const chatStep = await manager.advanceStep(key, "review", {}, "chat");
  assert.equal(chatStep.currentSurface, "chat");
  assert.equal(chatStep.waitReason, "userInput");
});

test("workflow: completeInstance sets completed status", async () => {
  const manager = createManager();
  const { key } = await manager.startInstance("user_1", "order-flow", "browse");

  await manager.completeInstance(key);
  const completed = await manager.getInstance(key);

  assert.ok(completed);
  assert.equal(completed.status, "completed");
  assert.ok(completed.revision > 1);
});

test("workflow: failInstance sets failed status with error details", async () => {
  const manager = createManager();
  const { key } = await manager.startInstance("user_1", "order-flow", "browse");

  await manager.failInstance(key, new Error("Payment declined"));
  const failed = await manager.getInstance(key);

  assert.ok(failed);
  assert.equal(failed.status, "failed");
  assert.equal(failed.stepId, "failed");
  assert.equal(failed.waitReason, "error");
  assert.deepEqual(failed.state.lastError, {
    message: "Payment declined",
    name: "Error"
  });
});

test("workflow: cancelInstance sets cancelled status", async () => {
  const manager = createManager();
  const { key } = await manager.startInstance("user_1", "order-flow", "browse");

  await manager.cancelInstance(key);
  const cancelled = await manager.getInstance(key);

  assert.ok(cancelled);
  assert.equal(cancelled.status, "cancelled");
  assert.ok(cancelled.revision > 1);
});

test("workflow: operations on expired instance throw", async () => {
  const manager = createManager({ defaultTTL: 0.01 });
  const { key } = await manager.startInstance("user_1", "order-flow", "browse");

  await new Promise((resolve) => setTimeout(resolve, 20));

  await assert.rejects(() => manager.advanceStep(key, "cart"), /was not found or already expired/);
});

test("workflow: operations on nonexistent key throw", async () => {
  const manager = createManager();
  await assert.rejects(
    () => manager.advanceStep("instance:nonexistent", "cart"),
    /was not found or already expired/
  );
  await assert.rejects(
    () => manager.completeInstance("instance:nonexistent"),
    /was not found or already expired/
  );
  await assert.rejects(
    () => manager.failInstance("instance:nonexistent", new Error("test")),
    /was not found or already expired/
  );
  await assert.rejects(
    () => manager.cancelInstance("instance:nonexistent"),
    /was not found or already expired/
  );
});

test("workflow: state mutation is additive — existing keys preserved", async () => {
  const manager = createManager();
  const { key } = await manager.startInstance("user_1", "order-flow", "browse", {
    userId: "user_1",
    cart: []
  });

  await manager.advanceStep(key, "cart", { cart: ["item-1"], selected: true });
  const state = await manager.getInstance(key);

  assert.ok(state);
  assert.deepEqual(state.state, {
    cart: ["item-1"],
    selected: true,
    userId: "user_1"
  });
});

test("workflow: key helpers produce consistent key formats", async () => {
  const manager = createManager();

  const stateKey = manager.createStateKey("user_42", "my-flow");
  assert.equal(stateKey, "flow:user_42:my-flow");

  const instanceKey = manager.createInstanceKey("inst_abc123");
  assert.equal(instanceKey, "instance:inst_abc123");
});

test("workflow: multiple instances for same user/flow share state key", async () => {
  const manager = createManager();
  await manager.startInstance("user_1", "order-flow", "browse");
  const { key: key2 } = await manager.startInstance("user_1", "order-flow", "browse");

  const stateKey = manager.createStateKey("user_1", "order-flow");
  const stateFromKey = await manager.getInstance(stateKey);

  assert.ok(stateFromKey);
  assert.equal(stateFromKey.instanceId, key2.replace("instance:", ""));
});

test("workflow: advanceStep with CAS-conflicting adapter rejects", async () => {
  const baseStorage = createFlowStorage({
    backend: "memory",
    defaultTTL: 60
  });
  const manager = new UserFlowStateManager({
    defaultTTL: baseStorage.defaultTTL,
    delete: baseStorage.delete.bind(baseStorage),
    get: baseStorage.get.bind(baseStorage),
    namespace: baseStorage.namespace,
    async compareAndSet() {
      return false;
    },
    set: baseStorage.set.bind(baseStorage),
    touch: baseStorage.touch.bind(baseStorage)
  });

  const { key } = await manager.startInstance("user_1", "order-flow", "browse");
  await assert.rejects(() => manager.advanceStep(key, "cart"), /Flow instance conflict/);
});

test("workflow: completeInstance after advance persists final state", async () => {
  const manager = createManager();
  const { key } = await manager.startInstance("user_1", "order-flow", "browse", {
    items: []
  });

  await manager.advanceStep(key, "cart", { items: ["item-1"] });
  await manager.advanceStep(key, "checkout", { total: 50 });
  await manager.completeInstance(key);

  const final = await manager.getInstance(key);
  assert.ok(final);
  assert.equal(final.status, "completed");
  assert.equal(final.stepId, "checkout");
  assert.deepEqual(final.state, { items: ["item-1"], total: 50 });
  assert.ok(final.revision >= 3);
});

test("workflow: state is cloned — mutations to returned instance do not affect storage", async () => {
  const manager = createManager();
  const { key } = await manager.startInstance("user_1", "order-flow", "browse", {
    cart: ["item-1"]
  });

  const first = await manager.getInstance(key);
  first.state.cart.push("item-2");

  const second = await manager.getInstance(key);
  assert.deepEqual(second.state.cart, ["item-1"]);
});
