import { TgButton, TgCard, TgText } from "teleforge/ui";

import type { Task } from "@task-shop/types";

interface TaskCardProps {
  onAdd: (task: Task) => void;
  onViewDetail?: () => void;
  task: Task;
}

export function TaskCard({ onAdd, onViewDetail, task }: TaskCardProps) {
  return (
    <TgCard padding="lg">
      <div className="task-card">
        <div className="task-card__meta">
          <span className="task-chip">{task.category}</span>
          <span className="task-chip task-chip--muted">{task.difficulty}</span>
          <span className="task-chip task-chip--muted">{task.estimatedTime}</span>
        </div>
        <div
          className="task-card__body"
          style={{ cursor: onViewDetail ? "pointer" : undefined }}
          onClick={onViewDetail}
        >
          <TgText variant="subtitle">{task.title}</TgText>
          <TgText variant="body">{task.description}</TgText>
        </div>
        <div className="task-card__footer">
          <TgText variant="caption">{task.price} Stars</TgText>
          <TgButton onClick={() => onAdd(task)} size="sm" variant="primary">
            Add to cart
          </TgButton>
        </div>
      </div>
    </TgCard>
  );
}
