import { UserFlowStateManager, createFlowStorage } from "@teleforge/core";

export function createTaskShopFlowStateManager(): UserFlowStateManager {
  return new UserFlowStateManager(
    createFlowStorage({
      backend: "memory",
      defaultTTL: 3600,
      namespace: "task-shop"
    })
  );
}
