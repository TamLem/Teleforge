import { type TaskShopFlowState, type TaskShopSubmitPayload } from "@task-shop/types";
import { defineScreen } from "teleforge/web";
import { TgButton, TgCard, TgText } from "teleforge/ui";

import { TaskShopFrame } from "./TaskShopFrame";

export default defineScreen<TaskShopFlowState>({
  component({ runAction, state, submit, transitioning }) {
    const handleSubmit = (payload: TaskShopSubmitPayload) => void submit?.(payload);

    return (
      <TaskShopFrame
        actions={
          runAction ? (
            <TgButton onClick={() => void runAction("return-to-chat")} size="sm" variant="secondary">
              Return to chat
            </TgButton>
          ) : null
        }
        subtitle="Task Shop keeps the final order in flow state until you start over."
        title="Success"
      >
        <TgCard padding="lg">
          <div className="success-card">
            <span className="hero-tag">Order sent</span>
            <TgText variant="title">Task Shop confirmation</TgText>
            <TgText variant="body">
              {state.lastOrder
                ? `Your last order included ${state.lastOrder.items.length} task(s) for ${state.lastOrder.total} Stars.`
                : "Complete checkout to see the latest order summary here."}
            </TgText>
            {state.lastOrder ? (
              <div className="stack-grid">
                {state.lastOrder.items.map((item) => (
                  <div className="line-item line-item--ghost" key={item.id}>
                    <TgText variant="body">{item.title}</TgText>
                    <TgText variant="caption">
                      {item.quantity} x {item.price} Stars
                    </TgText>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="hero-card__actions">
              <TgButton onClick={() => handleSubmit({ type: "start-over" })} variant="primary">
                Start over
              </TgButton>
              {runAction ? (
                <TgButton
                  onClick={() => void runAction("return-to-chat")}
                  variant="secondary"
                >
                  Send summary to chat
                </TgButton>
              ) : null}
            </div>
          </div>
        </TgCard>
        {transitioning ? <TgText variant="hint">Updating the flow…</TgText> : null}
      </TaskShopFrame>
    );
  },
  id: "task-shop.success",
  title: "Order Confirmed"
});
