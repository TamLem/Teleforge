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

  const stateKey = await manager.startFlow(
    "42",
    "task-shop-browse",
    "catalog",
    {
      source: "start"
    },
    "1001"
  );

  assert.match(stateKey, /^flow:/);
  assert.equal((await manager.resumeFlow("42", "task-shop-browse"))?.chatId, "1001");

  const advanced = await manager.advanceStep(stateKey, "review", {
    selectedTask: "task-001"
  });

  assert.equal(advanced.stepId, "review");
  assert.equal(advanced.payload.selectedTask, "task-001");
  assert.equal(advanced.version, 2);

  await manager.failFlow(stateKey, new Error("Checkout failed"));
  const failedState = await manager.getState(stateKey);

  assert.equal(failedState?.stepId, "failed");
  assert.deepEqual(failedState?.payload.lastError, {
    message: "Checkout failed",
    name: "Error"
  });

  await manager.completeFlow(stateKey);
  assert.equal(await manager.getState(stateKey), null);
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
  const stateKey = await manager.startFlow("42", "task-shop-browse", "catalog");

  await assert.rejects(manager.advanceStep(stateKey, "review"), /Flow state conflict/);
});
