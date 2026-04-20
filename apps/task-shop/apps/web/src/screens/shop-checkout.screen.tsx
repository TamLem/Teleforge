import { mockTasks } from "@task-shop/types";
import { useLaunchCoordination, defineScreen } from "teleforge/web";
import { AppShell, TgButton, TgCard, TgText } from "teleforge/ui";

interface ShopCheckoutState {
  orderId: string | null;
  selectedItem: string | null;
}

export default defineScreen<ShopCheckoutState>({
  component({ state, submit, transitioning }) {
    const { flowContext } = useLaunchCoordination();
    const itemId = (flowContext?.payload?.itemId as string | undefined) ?? state.selectedItem;
    const item = mockTasks.find((t) => t.id === itemId);

    return (
      <AppShell header={{ showBackButton: false, title: "Checkout" }}>
        <div style={{ padding: "16px" }}>
          {item ? (
            <>
              <TgCard padding="md">
                <TgText variant="title">{item.title}</TgText>
                <TgText variant="body">{item.description}</TgText>
                <TgText variant="hint">
                  {item.category} · {item.estimatedTime} · {item.difficulty}
                </TgText>
              </TgCard>
              <div style={{ marginTop: "12px" }}>
                <TgButton
                  onClick={() => submit?.({ type: "complete-order", itemId: itemId ?? "" })}
                  variant="primary"
                >
                  Complete purchase — {item.price} Stars
                </TgButton>
              </div>
            </>
          ) : (
            <TgCard padding="md">
              <TgText variant="title">Item not found</TgText>
              <TgText variant="body">The selected item could not be loaded.</TgText>
            </TgCard>
          )}
          {transitioning ? <TgText variant="hint">Processing…</TgText> : null}
        </div>
      </AppShell>
    );
  },
  id: "shop.checkout",
  title: "Checkout"
});
