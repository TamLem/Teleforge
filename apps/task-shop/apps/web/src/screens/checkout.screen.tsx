import {
  createOrderFromCart,
  getCartTotal,
  type TaskShopFlowState,
  type TaskShopSubmitPayload
} from "@task-shop/types";
import { ExpandedOnly } from "@teleforgex/ui";
import { TgButton, TgCard, TgText } from "@teleforgex/ui";
import { defineScreen } from "teleforge/web";

import { TaskShopFrame } from "./TaskShopFrame";

export default defineScreen<TaskShopFlowState>({
  component({ state, submit, transitioning }) {
    const handleSubmit = (payload: TaskShopSubmitPayload) => void submit?.(payload);
    const order = createOrderFromCart(state.cart);

    return (
      <TaskShopFrame
        onBack={() => handleSubmit({ type: "go-to-cart" })}
        subtitle={`${state.cart.length} line item(s) · ${getCartTotal(state.cart)} Stars`}
        title="Checkout"
      >
        {state.cart.length === 0 ? (
          <TgCard padding="lg">
            <div className="empty-state">
              <TgText variant="title">Nothing to checkout yet</TgText>
              <TgText variant="body">
                Add tasks to your cart before opening the guarded checkout flow.
              </TgText>
              <TgButton onClick={() => handleSubmit({ type: "browse" })} variant="primary">
                Back to tasks
              </TgButton>
            </div>
          </TgCard>
        ) : (
          <ExpandedOnly showExpandPrompt>
            <div className="page-grid">
              <div className="stack-grid">
                {order.items.map((item) => (
                  <TgCard key={item.id} padding="md">
                    <div className="line-item">
                      <div>
                        <TgText variant="subtitle">{item.title}</TgText>
                        <TgText variant="hint">{item.quantity} seat(s)</TgText>
                      </div>
                      <TgText variant="body">{item.price * item.quantity} Stars</TgText>
                    </div>
                  </TgCard>
                ))}
              </div>
              <TgCard padding="lg">
                <div className="summary-card">
                  <div>
                    <TgText variant="title">Checkout</TgText>
                    <TgText variant="hint">
                      The screen stays flow-owned while Telegram launch mode guards remain
                      component-level.
                    </TgText>
                  </div>
                  <dl className="summary-grid">
                    <div>
                      <dt>Items</dt>
                      <dd>{order.items.length}</dd>
                    </div>
                    <div>
                      <dt>Total</dt>
                      <dd>{order.total} Stars</dd>
                    </div>
                  </dl>
                  <TgButton
                    onClick={() => handleSubmit({ type: "complete-order" })}
                    variant="primary"
                  >
                    Complete purchase
                  </TgButton>
                </div>
              </TgCard>
            </div>
          </ExpandedOnly>
        )}
        {transitioning ? <TgText variant="hint">Processing checkout…</TgText> : null}
      </TaskShopFrame>
    );
  },
  id: "task-shop.checkout",
  title: "Checkout"
});
