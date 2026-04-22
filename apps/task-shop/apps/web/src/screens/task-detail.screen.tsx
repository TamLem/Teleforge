import { mockTasks, type TaskShopFlowState, type TaskShopSubmitPayload } from "@task-shop/types";
import { defineScreen } from "teleforge/web";
import { AppShell, TgButton, TgCard, TgText } from "teleforge/ui";

export default defineScreen<TaskShopFlowState>({
  component({ state, submit, transitioning }) {
    const task = mockTasks.find((t) => t.id === state.selectedTaskId);

    if (!task) {
      return (
        <AppShell header={{ showBackButton: true, title: "Task Detail" }}>
          <div style={{ padding: "16px" }}>
            <TgCard padding="md">
              <TgText variant="title">Task not found</TgText>
              <TgText variant="body">The selected task could not be loaded.</TgText>
            </TgCard>
            <TgButton
              onClick={() => submit?.({ type: "browse" })}
              style={{ marginTop: "12px" }}
              variant="secondary"
            >
              Back to catalog
            </TgButton>
          </div>
        </AppShell>
      );
    }

    const handleSubmit = (payload: TaskShopSubmitPayload) => void submit?.(payload);

    return (
      <AppShell header={{ showBackButton: true, title: task.title }}>
        <div style={{ padding: "16px" }}>
          <TgCard padding="lg">
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <span className="task-chip">{task.category}</span>
              <span className="task-chip task-chip--muted">{task.difficulty}</span>
              <span className="task-chip task-chip--muted">{task.estimatedTime}</span>
            </div>
            <TgText variant="subtitle">{task.title}</TgText>
            <TgText variant="body" style={{ marginTop: "8px" }}>
              {task.description}
            </TgText>
          </TgCard>
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <TgButton
              onClick={() => handleSubmit({ type: "browse" })}
              style={{ flex: 1 }}
              variant="secondary"
            >
              Back
            </TgButton>
            <TgButton
              onClick={() => handleSubmit({ taskId: task.id, type: "add-item" })}
              style={{ flex: 1 }}
              variant="primary"
            >
              Add to cart — {task.price} Stars
            </TgButton>
          </div>
          {transitioning ? <TgText variant="hint">Processing…</TgText> : null}
        </div>
      </AppShell>
    );
  },
  id: "task-shop.detail",
  title: "Task Detail"
});
