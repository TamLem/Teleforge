import { mockTasks } from "@task-shop/types";
import { defineFlow } from "teleforge/web";

export default defineFlow({
  id: "task-shop-tasks",
  initialStep: "catalogue",
  finalStep: "catalogue",
  state: {},
  bot: {
    command: {
      command: "tasks",
      description: "List the available sample tasks",
      text: "Task Shop catalogue"
    }
  },
  steps: {
    catalogue: {
      message: [
        "Task Shop catalogue:",
        ...mockTasks.map(
          (task) =>
            `- ${task.title} (${task.category}) - ${task.price} Stars, ${task.estimatedTime}, ${task.difficulty}`
        )
      ].join("\n"),
      type: "chat"
    }
  }
});
