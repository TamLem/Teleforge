import { defineLoader } from "teleforge";

export default defineLoader({
  handler: async ({ session, ctx }) => {
    const resource = ctx.subject?.resource as { type?: string; id?: string } | undefined;

    if (session) {
      const lastOrder = session.resource<{ order: Record<string, unknown> | null }>("lastOrder", {
        initialValue: { order: null }
      });
      const { order } = await lastOrder.get();

      // Chat-opened link: return only if the stored order matches the signed ID
      if (resource?.type === "order" && resource.id) {
        return { order: order?.id === resource.id ? order : null };
      }

      // In-app navigation: return whatever is in the session resource
      return { order };
    }

    return { order: null };
  }
});
