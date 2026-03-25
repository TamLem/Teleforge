import { mockTasks } from "@task-shop/types";

export function useTasks() {
  return {
    categories: Array.from(new Set(mockTasks.map((task) => task.category))),
    tasks: mockTasks
  };
}
