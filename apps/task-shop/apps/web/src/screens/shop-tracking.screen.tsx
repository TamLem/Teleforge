import { mockTasks } from "@task-shop/types";
import { AppShell, TgCard, TgText } from "@teleforgex/ui";
import { defineScreen } from "teleforge/web";

interface ShopTrackingState {
  orderId: string | null;
  selectedItem: string | null;
}

export default defineScreen<ShopTrackingState>({
  component({ state }) {
    const item = mockTasks.find((t) => t.id === state.selectedItem);

    return (
      <AppShell header={{ showBackButton: false, title: "Order Tracking" }}>
        <div style={{ padding: "16px" }}>
          <TgCard padding="md">
            <TgText variant="title">Order {state.orderId ?? "—"}</TgText>
            <div style={{ marginTop: "12px" }}>
              <TgText variant="body">
                {item ? `${item.title} — ${item.price} Stars` : "Unknown item"}
              </TgText>
            </div>
            <div
              style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <TgText variant="body">✓ Order placed</TgText>
              <TgText variant="body">◉ Processing</TgText>
              <TgText variant="hint">○ Shipping</TgText>
              <TgText variant="hint">○ Delivered</TgText>
            </div>
          </TgCard>
        </div>
      </AppShell>
    );
  },
  id: "shop.tracking",
  title: "Order Tracking"
});
