import { defineLoader } from "teleforge";

import type { CartLineItem } from "@task-shop/types";

export default defineLoader({
  handler: async ({ session }) => {
    if (!session) {
      return { items: [], subtotal: 0, itemCount: 0 };
    }

    // Get cart line items from session (references only)
    const cart = session.resource<{ items: CartLineItem[] }>("cart", {
      initialValue: { items: [] }
    });
    const { items: lineItems } = await cart.get();

    // Resolve to display data
    const { resolveCartItems, getCartSubtotal, getCartItemCount } = await import("@task-shop/types");
    const displayItems = resolveCartItems(lineItems);

    return {
      items: displayItems,
      subtotal: getCartSubtotal(displayItems),
      itemCount: getCartItemCount(displayItems)
    };
  }
});
