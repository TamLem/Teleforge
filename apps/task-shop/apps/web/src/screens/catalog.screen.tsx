import {
  getCartCount,
  getCartTotal,
  mockTasks,
  type TaskShopFlowState,
  type TaskShopSubmitPayload
} from "@task-shop/types";
import { TgButton, TgCard, TgText } from "teleforge/ui";
import { useLaunch } from "teleforge/web";
import { defineScreen } from "teleforge/web";

import { InitDataStatus } from "../components/InitDataStatus";
import { TaskCard } from "../components/TaskCard";

import { TaskShopFrame } from "./TaskShopFrame";

export default defineScreen<TaskShopFlowState>({
  component({ state, submit, transitioning }) {
    const { user } = useLaunch();
    const cartCount = getCartCount(state.cart);
    const cartTotal = getCartTotal(state.cart);

    const handleSubmit = (payload: TaskShopSubmitPayload) => void submit?.(payload);

    return (
      <TaskShopFrame
        actions={
          <>
            <TgButton
              onClick={() => handleSubmit({ type: "go-to-cart" })}
              size="sm"
              variant="secondary"
            >
              View cart ({cartCount})
            </TgButton>
            <TgButton
              onClick={() => handleSubmit({ type: "go-to-checkout" })}
              size="sm"
              variant="primary"
            >
              Checkout
            </TgButton>
          </>
        }
        subtitle={`${cartCount} item(s) in cart · ${cartTotal} Stars`}
        title="Task Shop"
      >
        <div className="page-grid">
          <TgCard padding="lg">
            <div className="hero-card">
              <div className="hero-card__copy">
                <span className="hero-tag">Flow-first sample</span>
                <TgText variant="title">Browse Telegram-native tasks</TgText>
                <TgText variant="body">
                  This Mini App is now driven by Teleforge flow definitions and discovered screens
                  instead of a local route switcher.
                </TgText>
                <TgText variant="hint">
                  {user
                    ? `Signed in as ${user.first_name}.`
                    : "Launch from Telegram to attach user context."}
                </TgText>
              </div>
            </div>
          </TgCard>
          <InitDataStatus />
          <div className="catalog-grid">
            {mockTasks.map((task) => (
              <TaskCard
                key={task.id}
                onAdd={() => handleSubmit({ taskId: task.id, type: "add-item" })}
                onViewDetail={() => handleSubmit({ taskId: task.id, type: "view-detail" })}
                task={task}
              />
            ))}
          </div>
          {transitioning ? <TgText variant="hint">Updating your Task Shop flow…</TgText> : null}
        </div>
      </TaskShopFrame>
    );
  },
  id: "task-shop.catalog",
  title: "Browse Tasks"
});
