import { useEventPublisher } from "@teleforgex/core/react";
import { ExpandedOnly, TgButton, TgCard, TgText } from "@teleforgex/ui";
import { completeFlow, useCoordinatedMainButton } from "@teleforgex/web";

import type { CartItem, OrderPayload } from "@task-shop/types";

interface CheckoutPageProps {
  completeOrder: (payload: OrderPayload) => void;
  items: CartItem[];
  navigate: (path: string) => void;
  total: number;
}

export function CheckoutPage({ completeOrder, items, navigate, total }: CheckoutPageProps) {
  const publishOrder = useEventPublisher();
  const payload: OrderPayload = {
    currency: "Stars",
    items: items.map((item) => ({
      id: item.id,
      price: item.price,
      quantity: item.quantity,
      title: item.title
    })),
    total,
    type: "order_completed"
  };
  const handleCheckout = async () => {
    let returnedToChat = false;

    try {
      await completeFlow(
        {
          order: payload
        },
        {
          returnMessage: "Task Shop order returned to chat."
        }
      );
      returnedToChat = true;
    } catch {
      try {
        publishOrder(payload);
      } catch {
        // Local browser previews may not have Telegram WebApp.sendData available.
      }
    }

    completeOrder(payload);
    navigate("/success");

    return returnedToChat;
  };

  useCoordinatedMainButton("Return to Chat", handleCheckout, {
    isVisible: items.length > 0
  });

  if (items.length === 0) {
    return (
      <TgCard padding="lg">
        <div className="empty-state">
          <TgText variant="title">Nothing to checkout yet</TgText>
          <TgText variant="body">
            Add tasks to your cart before opening the guarded checkout flow.
          </TgText>
          <TgButton onClick={() => navigate("/")} variant="primary">
            Back to tasks
          </TgButton>
        </div>
      </TgCard>
    );
  }

  return (
    <ExpandedOnly showExpandPrompt>
      <div className="page-grid">
        <div className="stack-grid">
          {payload.items.map((item) => (
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
                This route is guarded with `ExpandedOnly`, so inline launches get an expand prompt
                before purchase.
              </TgText>
            </div>
            <dl className="summary-grid">
              <div>
                <dt>Items</dt>
                <dd>{payload.items.length}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{payload.total} Stars</dd>
              </div>
            </dl>
            <TgButton onClick={() => void handleCheckout()} variant="primary">
              Complete purchase
            </TgButton>
          </div>
        </TgCard>
      </div>
    </ExpandedOnly>
  );
}
