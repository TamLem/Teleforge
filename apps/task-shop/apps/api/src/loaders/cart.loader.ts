import { defineLoader } from "teleforge";

import type { CartItem } from "@task-shop/types";

export default defineLoader({
  handler: async ({ session }) => {
    if (!session) {
      return { items: [], subtotal: 0, itemCount: 0 };
    }

    const cart = session.resource<{ items: CartItem[] }>("cart", {
      initialValue: { items: [] }
    });
    const { items } = await cart.get();

    const { getCartSubtotal, getCartItemCount } = await import("@task-shop/types");

    return {
      items,
      subtotal: getCartSubtotal(items),
      itemCount: getCartItemCount(items)
    };
  }
});
