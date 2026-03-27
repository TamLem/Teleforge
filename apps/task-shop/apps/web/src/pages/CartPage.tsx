import { TgButton, TgCard, TgText } from "@teleforgex/ui";

import { CartSummary } from "../components/CartSummary";

import type { CartItem } from "@task-shop/types";

interface CartPageProps {
  items: CartItem[];
  navigate: (path: string) => void;
  onRemove: (taskId: string) => void;
  total: number;
}

export function CartPage({ items, navigate, onRemove, total }: CartPageProps) {
  if (items.length === 0) {
    return (
      <TgCard padding="lg">
        <div className="empty-state">
          <TgText variant="title">Cart is empty</TgText>
          <TgText variant="body">Add a few tasks from the catalogue before checking out.</TgText>
          <TgButton onClick={() => navigate("/")} variant="primary">
            Browse tasks
          </TgButton>
        </div>
      </TgCard>
    );
  }

  return (
    <div className="page-grid">
      <div className="stack-grid">
        {items.map((item) => (
          <TgCard key={item.id} padding="md">
            <div className="line-item">
              <div>
                <TgText variant="subtitle">{item.title}</TgText>
                <TgText variant="hint">
                  {item.quantity} x {item.price} Stars
                </TgText>
              </div>
              <TgButton onClick={() => onRemove(item.id)} size="sm" variant="secondary">
                Remove
              </TgButton>
            </div>
          </TgCard>
        ))}
      </div>
      <CartSummary
        actionLabel="Continue to checkout"
        count={items.reduce((sum, item) => sum + item.quantity, 0)}
        onAction={() => navigate("/checkout")}
        subtitle="Local cart state persists between route changes."
        total={total}
      />
    </div>
  );
}
