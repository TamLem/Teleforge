import { createTypedSignForActionContext, defineFlow } from "teleforge";

import type { CartItem } from "@task-shop/types";
import type { TeleforgeInputSchema, TypedSignHelpers } from "teleforge";

// Shared route map used by both miniApp.routes and typed sign helpers.
const gadgetshopRoutes = {
  "/": "catalog",
  "/product/:id": "product-detail",
  "/cart": "cart",
  "/confirmation": "confirmation",
  "/tracking": "tracking"
} as const;

// Local type alias matching the generated GadgetshopSign so the bot
// package does not need to import from the web app source tree.
type GadgetshopSign = TypedSignHelpers<{
  catalog: undefined;
  productDetail: { id: string };
  cart: undefined;
  confirmation: undefined;
  tracking: undefined;
}>;

function createSchema<T>(schema: TeleforgeInputSchema<T>): TeleforgeInputSchema<T> {
  return schema;
}

const addToCartSchema = createSchema<{ productId: string; qty: number }>({
  safeParse(input: unknown) {
    if (typeof input !== "object" || input === null)
      return { success: false, error: "Input must be an object" };
    const obj = input as Record<string, unknown>;
    if (typeof obj.productId !== "string" || obj.productId.length === 0)
      return { success: false, error: "productId is required" };
    const qty = obj.qty ?? 1;
    if (typeof qty !== "number" || !Number.isInteger(qty) || qty <= 0)
      return { success: false, error: "qty must be a positive integer" };
    return { success: true, data: { productId: obj.productId, qty } };
  }
});

const removeFromCartSchema = createSchema<{ productId: string }>({
  safeParse(input: unknown) {
    if (typeof input !== "object" || input === null)
      return { success: false, error: "Input must be an object" };
    const obj = input as Record<string, unknown>;
    if (typeof obj.productId !== "string" || obj.productId.length === 0)
      return { success: false, error: "productId is required" };
    return { success: true, data: { productId: obj.productId } };
  }
});

export default defineFlow({
  id: "gadgetshop",

  session: {
    enabled: true
  },

  command: {
    command: "shop",
    description: "Browse and shop electronics",
    handler: async ({ ctx, sign }) => {
      const typedSign = createTypedSignForActionContext({
        sign,
        routes: gadgetshopRoutes
      }) as unknown as GadgetshopSign;

      const catalogLaunch = await typedSign.catalog({
        subject: {},
        allowedActions: ["addToCart", "removeFromCart", "placeOrder"]
      });

      const itemsPerMessage = 6;
      const { products } = await import("@task-shop/types");

      await ctx.reply(
        "**GadgetShop** \u2014 the latest smartphones, laptops, audio, and accessories.",
        { parse_mode: "Markdown" }
      );

      const batch = products.slice(0, itemsPerMessage);
      for (const product of batch) {
        const url = await typedSign.productDetail({
          params: { id: product.id },
          subject: { resource: { type: "product", id: product.id } },
          allowedActions: ["addToCart", "removeFromCart", "placeOrder"]
        });

        await ctx.reply(
          `${product.image} **${product.name}** \u2014 $${product.price}\n_${product.description}_`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[{ text: "View Details \u2192", web_app: { url } }]]
            }
          }
        );
      }

      const remaining = products.length - itemsPerMessage;
      if (remaining > 0) {
        await ctx.reply(
          `${remaining} more products available. Open the full store to browse all categories.`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: `\uD83D\uDED2 Open Full Store (${products.length} items)`,
                    web_app: { url: catalogLaunch }
                  }
                ]
              ]
            }
          }
        );
      }
    }
  },

  miniApp: {
    routes: gadgetshopRoutes,
    defaultRoute: "/",
    title: "GadgetShop"
  },

  actions: {
    addToCart: {
      input: addToCartSchema,
      handler: async ({ input, session, services: _services }) => {
        const {
          getProduct,
          addToCart: addItem,
          getCartItemCount
        } = await import("@task-shop/types");
        const product = getProduct(input.productId);
        if (!product) return { data: { error: "Product not found" } };

        if (!session) return { data: { error: "Session required" } };

        const cartRes = session.resource<{ items: CartItem[] }>("cart", {
          initialValue: { items: [] }
        });
        const { items } = await cartRes.get();
        const newItems = addItem(items, product, input.qty);
        await cartRes.set({ items: newItems });

        return {
          data: {
            items: newItems,
            itemCount: getCartItemCount(newItems),
            justAdded: product.name
          }
        };
      }
    },

    removeFromCart: {
      input: removeFromCartSchema,
      handler: async ({ input, session, services: _services }) => {
        const {
          removeFromCart: removeItem,
          getCartItemCount,
          getCartSubtotal
        } = await import("@task-shop/types");

        if (!session) return { data: { error: "Session required" } };

        const cartRes = session.resource<{ items: CartItem[] }>("cart", {
          initialValue: { items: [] }
        });
        const { items } = await cartRes.get();
        const newItems = removeItem(items, input.productId);
        await cartRes.set({ items: newItems });

        return {
          data: {
            items: newItems,
            itemCount: getCartItemCount(newItems),
            subtotal: getCartSubtotal(newItems)
          },
          redirect: {
            screenId: "cart",
            replace: true,
            reason: "reload"
          }
        };
      }
    },

    placeOrder: {
      handler: async ({ ctx: _ctx, session, sign }) => {
        if (!session) return { data: { error: "Session required" } };

        const { createOrder } = await import("@task-shop/types");

        const cartRes = session.resource<{ items: CartItem[] }>("cart", {
          initialValue: { items: [] }
        });
        const { items } = await cartRes.get();

        if (items.length === 0) return { data: { error: "Cart is empty" } };

        const order = createOrder(items);

        const orderRes = session.resource<{ order: unknown }>("lastOrder", {
          initialValue: { order: null }
        });
        await orderRes.set({ order });

        const itemLines = order.items
          .map(
            (i) => `  ${i.image} ${i.name} ×${i.quantity} — $${(i.price * i.quantity).toFixed(2)}`
          )
          .join("\n");

        const typedSign = createTypedSignForActionContext({
          sign,
          routes: gadgetshopRoutes
        }) as unknown as GadgetshopSign;

        const trackingUrl = await typedSign.tracking({
          subject: { resource: { type: "order", id: order.id } },
          allowedActions: []
        });

        return {
          data: { placed: true, orderId: order.id },
          effects: [
            {
              type: "chatMessage",
              text: [
                "\uD83D\uDED2 Order confirmed!",
                "",
                `Order #${order.id}`,
                "",
                itemLines,
                "",
                `Total: $${order.total.toFixed(2)}`,
                "",
                "Thank you for shopping at GadgetShop."
              ].join("\n"),
              replyMarkup: {
                inline_keyboard: [
                  [{ text: "\uD83D\uDCCD Track Order", web_app: { url: trackingUrl } }]
                ]
              }
            }
          ]
        };
      }
    }
  }
});
