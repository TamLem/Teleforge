import {
  getCartCount,
  getCartTotal,
  type TaskShopFlowState,
  type TaskShopSubmitPayload
} from "@task-shop/types";
import { TgButton, TgCard, TgText } from "@teleforgex/ui";
import { defineScreen } from "teleforge/web";

import { CartSummary } from "../components/CartSummary";

import { TaskShopFrame } from "./TaskShopFrame";

export default defineScreen<TaskShopFlowState>({
  component({ state, submit, transitioning }) {
    const handleSubmit = (payload: TaskShopSubmitPayload) => void submit?.(payload);
    const count = getCartCount(state.cart);
    const total = getCartTotal(state.cart);

    return (
      <TaskShopFrame
        onBack={() => handleSubmit({ type: "browse" })}
        subtitle={`${count} item(s) in cart · ${total} Stars`}
        title="Cart"
      >
        {state.cart.length === 0 ? (
          <TgCard padding="lg">
            <div className="empty-state">
              <TgText variant="title">Cart is empty</TgText>
              <TgText variant="body">
                Add a few tasks from the catalogue before checking out.
              </TgText>
              <TgButton onClick={() => handleSubmit({ type: "browse" })} variant="primary">
                Browse tasks
              </TgButton>
            </div>
          </TgCard>
        ) : (
          <div className="page-grid">
            <div className="stack-grid">
              {state.cart.map((item) => (
                <TgCard key={item.id} padding="md">
                  <div className="line-item">
                    <div>
                      <TgText variant="subtitle">{item.title}</TgText>
                      <TgText variant="hint">
                        {item.quantity} x {item.price} Stars
                      </TgText>
                    </div>
                    <TgButton
                      onClick={() => handleSubmit({ taskId: item.id, type: "remove-item" })}
                      size="sm"
                      variant="secondary"
                    >
                      Remove
                    </TgButton>
                  </div>
                </TgCard>
              ))}
            </div>
            <CartSummary
              actionLabel="Continue to checkout"
              count={count}
              onAction={() => handleSubmit({ type: "go-to-checkout" })}
              subtitle="Cart state now lives in the Teleforge flow snapshot."
              total={total}
            />
          </div>
        )}
        {transitioning ? <TgText variant="hint">Applying cart changes…</TgText> : null}
      </TaskShopFrame>
    );
  },
  id: "task-shop.cart",
  title: "Your Cart"
});
