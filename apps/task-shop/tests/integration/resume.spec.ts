import assert from "node:assert/strict";
import test from "node:test";

import {
  createTaskShopFlowResolver,
  getTaskShopFlowId,
  getTaskShopResumeSnapshot,
  persistTaskShopFlowState,
  resolveTaskShopResumeRoute
} from "../../apps/web/src/flowResume.ts";

test("Task Shop flow resolver restores checkout state from injected storage", async () => {
  const storage = createMemoryStorage();

  persistTaskShopFlowState({
    items: [
      {
        category: "Setup",
        difficulty: "Easy",
        estimatedTime: "20m",
        id: "task-001",
        price: 10,
        quantity: 1,
        title: "Build Mini App Scaffold"
      }
    ],
    lastOrder: null,
    now: 100,
    route: "/checkout",
    storage,
    userId: "42"
  });

  const flowState = await createTaskShopFlowResolver(storage)(getTaskShopFlowId());

  assert.ok(flowState);
  assert.equal(resolveTaskShopResumeRoute(flowState), "/checkout");
  assert.equal(getTaskShopResumeSnapshot(flowState).items[0]?.id, "task-001");
});

test("Task Shop flow resolver records completed flows for fresh-start recovery", async () => {
  const storage = createMemoryStorage();

  persistTaskShopFlowState({
    items: [],
    lastOrder: {
      currency: "Stars",
      items: [],
      total: 0,
      type: "order_completed"
    },
    now: 100,
    route: "/success",
    storage,
    userId: "42"
  });

  const flowState = await createTaskShopFlowResolver(storage)(getTaskShopFlowId());

  assert.ok(flowState);
  assert.equal(flowState.stepId, "completed");
  assert.equal(getTaskShopResumeSnapshot(flowState).lastOrder?.type, "order_completed");
});

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };
}
