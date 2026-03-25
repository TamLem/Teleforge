import { TgButton, TgCard, TgText } from "@teleforge/ui";

import type { OrderPayload } from "@task-shop/types";

interface SuccessPageProps {
  lastOrder: OrderPayload | null;
  navigate: (path: string) => void;
}

export function SuccessPage({ lastOrder, navigate }: SuccessPageProps) {
  return (
    <TgCard padding="lg">
      <div className="success-card">
        <span className="hero-tag">Order sent</span>
        <TgText variant="title">Task Shop confirmation</TgText>
        <TgText variant="body">
          {lastOrder
            ? `Your last order included ${lastOrder.items.length} task(s) for ${lastOrder.total} Stars.`
            : "Complete checkout to see the latest order summary here."}
        </TgText>
        {lastOrder ? (
          <div className="stack-grid">
            {lastOrder.items.map((item) => (
              <div className="line-item line-item--ghost" key={item.id}>
                <TgText variant="body">{item.title}</TgText>
                <TgText variant="caption">
                  {item.quantity} x {item.price} Stars
                </TgText>
              </div>
            ))}
          </div>
        ) : null}
        <TgButton onClick={() => navigate("/")} variant="primary">
          Back to catalogue
        </TgButton>
      </div>
    </TgCard>
  );
}
