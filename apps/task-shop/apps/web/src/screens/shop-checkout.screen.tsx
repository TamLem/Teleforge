import { mockTasks } from "@task-shop/types";
import { AppShell, TgButton, TgCard, TgText } from "teleforge/ui";
import { defineScreen } from "teleforge/web";

interface ShopCheckoutState {
  orderId: string | null;
  selectedItem: string | null;
}

export default defineScreen<ShopCheckoutState>({
  component({ state, submit, transitioning }) {
    const item = mockTasks.find((t) => t.id === state.selectedItem);

    if (!item) {
      return (
        <AppShell header={{ showBackButton: false, title: "Shop" }}>
          <div style={{ padding: "16px" }}>
            <TgCard padding="md">
              <TgText variant="title">Select an item</TgText>
              <TgText variant="body" style={{ marginBottom: "12px" }}>
                Choose a task to purchase:
              </TgText>
            </TgCard>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}
            >
              {mockTasks.map((task) => (
                <TgCard key={task.id} padding="md">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <TgText variant="subtitle">{task.title}</TgText>
                      <TgText variant="hint">{task.price} Stars</TgText>
                    </div>
                    <TgButton
                      onClick={() => submit?.({ type: "select-item", itemId: task.id })}
                      size="sm"
                      variant="primary"
                    >
                      Select
                    </TgButton>
                  </div>
                </TgCard>
              ))}
            </div>
            {transitioning ? <TgText variant="hint">Processing…</TgText> : null}
          </div>
        </AppShell>
      );
    }

    return (
      <AppShell header={{ showBackButton: false, title: "Checkout" }}>
        <div style={{ padding: "16px" }}>
          <TgCard padding="md">
            <TgText variant="title">{item.title}</TgText>
            <TgText variant="body">{item.description}</TgText>
            <TgText variant="hint">
              {item.category} · {item.estimatedTime} · {item.difficulty}
            </TgText>
          </TgCard>
          <div style={{ marginTop: "12px" }}>
            <TgButton onClick={() => submit?.({ type: "complete-order" })} variant="primary">
              Complete purchase — {item.price} Stars
            </TgButton>
          </div>
          {transitioning ? <TgText variant="hint">Processing…</TgText> : null}
        </div>
      </AppShell>
    );
  },
  id: "shop.checkout",
  title: "Checkout"
});
