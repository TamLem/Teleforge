import { defineLoader } from "teleforge";

import type { LastOrderReference } from "@task-shop/types";

export default defineLoader({
  handler: async ({ session, ctx }) => {
    const resource = ctx.subject?.resource as { type?: string; id?: string } | undefined;

    // If we have a signed subject with order ID, look it up from the store
    if (resource?.type === "order" && resource.id) {
      const { getOrder } = await import("@task-shop/types");
      const order = getOrder(resource.id);
      return { order };
    }

    // Otherwise, fall back to session-stored reference
    if (session) {
      const lastOrder = session.resource<LastOrderReference>("lastOrder", {
        initialValue: { orderId: "" }
      });
      const { orderId } = await lastOrder.get();

      if (orderId) {
        const { getOrder } = await import("@task-shop/types");
        const order = getOrder(orderId);
        return { order };
      }
    }

    return { order: null };
  }
});
