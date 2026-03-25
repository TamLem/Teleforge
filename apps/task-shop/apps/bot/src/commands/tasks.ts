import { mockTasks } from "@task-shop/types";

import type { BotCommandDefinition } from "@teleforge/bot";

export const tasksCommand: BotCommandDefinition = {
  command: "tasks",
  description: "List the available sample tasks",
  handler() {
    const lines = [
      "Task Shop catalogue:",
      ...mockTasks.map(
        (task) =>
          `- ${task.title} (${task.category}) - ${task.price} Stars, ${task.estimatedTime}, ${task.difficulty}`
      )
    ];

    return {
      text: lines.join("\n")
    };
  }
};
