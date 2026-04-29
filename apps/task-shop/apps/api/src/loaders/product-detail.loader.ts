import { defineLoader } from "teleforge";

import type { TeleforgeInputSchema } from "teleforge";

const inputSchema: TeleforgeInputSchema<{ id: string }> = {
  safeParse(input: unknown) {
    if (typeof input !== "object" || input === null) {
      return { success: false, error: { message: "Input must be an object" } };
    }
    const obj = input as Record<string, unknown>;
    const id = obj.id;
    if (typeof id !== "string" || id.length === 0) {
      return { success: false, error: { message: "id is required" } };
    }
    return { success: true, data: { id } };
  }
};

export default defineLoader({
  input: inputSchema,
  handler: async ({ input }) => {
    const { getProduct } = await import("@task-shop/types");
    const product = getProduct(input.id);
    if (!product) {
      return { product: null, notFound: true };
    }
    return { product, notFound: false };
  }
});
