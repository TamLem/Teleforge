import assert from "node:assert/strict";
import test from "node:test";

import { UserFlowStateManager, createFlowStorage } from "../../dist/index.js";

test("UserFlowStateManager handles the flow lifecycle", async () => {
  const manager = new UserFlowStateManager(
    createFlowStorage({
      backend: "memory",
      defaultTTL: 60,
      namespace: "task-shop"
    })
  );

  const { instanceId, key } = await manager.startInstance(
    "42",
    "task-shop-browse",
    "catalog",
    {
      source: "start"
    },
    "1001"
  );

  assert.match(key, /^instance:/);
  assert.match(instanceId, /^inst_/);

  const resumed = await manager.resumeFlow("42", "task-shop-browse");
  assert.ok(resumed);
  assert.equal(resumed.chatId, "1001");
  assert.equal(resumed.status, "active");
  assert.equal(resumed.revision, 1);

  const advanced = await manager.advanceStep(key, "review", {
    selectedTask: "task-001"
  });

  assert.equal(advanced.stepId, "review");
  assert.equal(advanced.state.selectedTask, "task-001");
  assert.equal(advanced.revision, 2);

  await manager.failInstance(key, new Error("Checkout failed"));
  const failedState = await manager.getInstance(key);

  assert.ok(failedState);
  assert.equal(failedState.stepId, "failed");
  assert.equal(failedState.status, "failed");
  assert.deepEqual(failedState.state.lastError, {
    message: "Checkout failed",
    name: "Error"
  });

  await manager.completeInstance(key);
  const completedState = await manager.getInstance(key);
  assert.ok(completedState);
  assert.equal(completedState.status, "completed");
  assert.equal(completedState.revision, 4);
});

test("UserFlowStateManager surfaces optimistic-lock conflicts", async () => {
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
  const { key } = await manager.startInstance("42", "task-shop-browse", "catalog");

  await assert.rejects(manager.advanceStep(key, "review"), /Flow instance conflict/);
});
