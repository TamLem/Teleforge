import { defineLoader } from "teleforge";

export default defineLoader({
  handler: async () => {
    const { products } = await import("@task-shop/types");
    return { products };
  }
});
