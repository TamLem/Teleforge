import { defineLoader } from "teleforge";

import type { LastOrderReference } from "@task-shop/types";

export default defineLoader({
  handler: async ({ session }) => {
    if (!session) {
      return { order: null };
    }

    // Get the order reference from session
    const lastOrder = session.resource<LastOrderReference>("lastOrder", {
      initialValue: { orderId: "" }
    });
    const { orderId } = await lastOrder.get();

    // Resolve the order from the store
    if (orderId) {
      const { getOrder } = await import("@task-shop/types");
      const order = getOrder(orderId);
      return { order };
    }

    return { order: null };
  }
});
