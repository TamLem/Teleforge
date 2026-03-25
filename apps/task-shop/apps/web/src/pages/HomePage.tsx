import { TgButton, TgCard, TgText } from "@teleforge/ui";
import { useLaunch } from "@teleforge/web";

import { InitDataStatus } from "../components/InitDataStatus";
import { TaskCard } from "../components/TaskCard";
import { useTasks } from "../hooks/useTasks";

import type { Task } from "@task-shop/types";

interface HomePageProps {
  cartCount: number;
  navigate: (path: string) => void;
  onAddToCart: (task: Task) => void;
}

export function HomePage({ cartCount, navigate, onAddToCart }: HomePageProps) {
  const { tasks } = useTasks();
  const { user } = useLaunch();

  return (
    <div className="page-grid">
      <TgCard padding="lg">
        <div className="hero-card">
          <div className="hero-card__copy">
            <span className="hero-tag">Reference Mini App</span>
            <TgText variant="title">Task Shop</TgText>
            <TgText variant="body">
              Browse six Teleforge-inspired work items, keep a persistent cart, and finish checkout
              in a guarded launch mode.
            </TgText>
            <TgText variant="hint">
              {user
                ? `Signed in as ${user.first_name}.`
                : "Launch from Telegram to attach user context."}
            </TgText>
          </div>
          <div className="hero-card__actions">
            <TgButton onClick={() => navigate("/cart")} variant="primary">
              View cart ({cartCount})
            </TgButton>
            <TgButton onClick={() => navigate("/checkout")} variant="secondary">
              Jump to checkout
            </TgButton>
          </div>
        </div>
      </TgCard>
      <InitDataStatus />
      <div className="catalog-grid">
        {tasks.map((task) => (
          <TaskCard key={task.id} onAdd={onAddToCart} task={task} />
        ))}
      </div>
    </div>
  );
}
