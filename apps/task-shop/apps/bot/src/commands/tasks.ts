import { mockTasks } from "@task-shop/types";

import type { BotCommandDefinition } from "@teleforgex/bot";
import type { UserFlowStateManager } from "@teleforgex/core";

export function createTasksCommand(flowStateManager: UserFlowStateManager): BotCommandDefinition {
  return {
    command: "tasks",
    description: "List the available sample tasks",
    async handler(context) {
      const activeFlow = await flowStateManager.resumeFlow(
        String(context.user.id),
        "task-shop-browse"
      );
      const lines = [
        "Task Shop catalogue:",
        ...(activeFlow
          ? [
              `Resuming flow ${activeFlow.flowId} at step ${activeFlow.stepId}.`,
              `State version: ${activeFlow.version}`
            ]
          : []),
        ...mockTasks.map(
          (task) =>
            `- ${task.title} (${task.category}) - ${task.price} Stars, ${task.estimatedTime}, ${task.difficulty}`
        )
      ];

      if (activeFlow) {
        await flowStateManager.advanceStep(
          flowStateManager.createStateKey(String(context.user.id), "task-shop-browse"),
          "tasks-reviewed",
          {
            lastCommand: "tasks"
          }
        );
      }

      return {
        text: lines.join("\n")
      };
    }
  };
}
