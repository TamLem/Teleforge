import { defineLoader } from "teleforge";

export default defineLoader({
  handler: async ({ session }) => {
    if (!session) {
      return { order: null };
    }

    const lastOrder = session.resource<{ order: unknown }>("lastOrder", {
      initialValue: { order: null }
    });
    const { order } = await lastOrder.get();
    return { order };
  }
});
