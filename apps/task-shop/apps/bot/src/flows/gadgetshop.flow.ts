import {
  addToCart,
  createOrder,
  getCartItemCount,
  getCartSubtotal,
  getProduct,
  products,
  removeFromCart,
  type CartItem
} from "@task-shop/types";
import { defineFlow } from "teleforge";
import { createSignedActionContext } from "@teleforgex/core";

export default defineFlow({
  id: "gadgetshop",

  command: {
    command: "shop",
    description: "Browse and shop electronics",
    handler: async ({ ctx, sign }) => {
      const catalogLaunch = await sign({
        flowId: "gadgetshop",
        screenId: "catalog",
        subject: { products },
        allowedActions: [
          "addToCart", "removeFromCart", "viewDetail",
          "viewCart", "placeOrder", "backToCatalog"
        ]
      });

      const itemsPerMessage = 6;

      await ctx.reply(
        "**GadgetShop** \u2014 the latest smartphones, laptops, audio, and accessories.",
        { parse_mode: "Markdown" }
      );

      // Send first batch of products, one per message
      const batch = products.slice(0, itemsPerMessage);
      for (const product of batch) {
        const url = await sign({
          flowId: "gadgetshop",
          screenId: "product-detail",
          subject: { product, cart: [] },
          allowedActions: ["addToCart", "removeFromCart", "viewDetail", "viewCart", "placeOrder", "backToCatalog"]
        });

        await ctx.reply(
          `${product.image} **${product.name}** \u2014 $${product.price}\n_${product.description}_`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[
                { text: "View Details \u2192", web_app: { url } }
              ]]
            }
          }
        );
      }

      // Pagination / full store
      const remaining = products.length - itemsPerMessage;
      if (remaining > 0) {
        await ctx.reply(
          `${remaining} more products available. Open the full store to browse all categories.`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: `\uD83D\uDED2 Open Full Store (${products.length} items)`, web_app: { url: catalogLaunch } }
              ]]
            }
          }
        );
      }
    }
  },

  miniApp: {
    routes: {
      "/": "catalog",
      "/product/:id": "product-detail",
      "/cart": "cart",
      "/confirmation": "confirmation",
      "/tracking": "tracking"
    },
    defaultRoute: "/",
    title: "GadgetShop"
  },

  actions: {
    addToCart: {
      handler: async ({ data }) => {
        const payload = data as { productId: string; qty?: number; cart?: CartItem[] };
        const product = getProduct(payload.productId);
        if (!product) return { data: { error: "Product not found" } };

        const currentCart = payload.cart ?? [];
        const newCart = addToCart(currentCart, product, payload.qty ?? 1);

        return {
          data: {
            cart: newCart,
            itemCount: getCartItemCount(newCart),
            justAdded: product.name
          }
        };
      }
    },

    removeFromCart: {
      handler: async ({ data }) => {
        const payload = data as { productId: string; cart?: CartItem[] };
        const newCart = removeFromCart(payload.cart ?? [], payload.productId);

        return {
          data: {
            cart: newCart,
            itemCount: getCartItemCount(newCart),
            subtotal: getCartSubtotal(newCart)
          }
        };
      }
    },

    viewDetail: {
      handler: async ({ data }) => {
        const payload = data as { productId: string };
        const product = getProduct(payload.productId);
        if (!product) return { data: { error: "Product not found" } };
        return { data: { product } };
      }
    },

    viewCart: {
      handler: async ({ data }) => {
        const cart = (data as { cart?: CartItem[] }).cart ?? [];
        return {
          data: { cart, subtotal: getCartSubtotal(cart), itemCount: getCartItemCount(cart) }
        };
      }
    },

    placeOrder: {
      handler: async ({ ctx, data }) => {
        const cart = (data as { cart?: CartItem[] }).cart ?? [];
        if (cart.length === 0) return { data: { error: "Cart is empty" } };
        const order = createOrder(cart);
        const items = order.items.map((i) => `  ${i.image} ${i.name} ×${i.quantity} — $${(i.price * i.quantity).toFixed(2)}`).join("\n");

        const now = Math.floor(Date.now() / 1000);
        const trackingToken = createSignedActionContext(
          {
            appId: ctx.appId,
            flowId: ctx.flowId,
            screenId: "tracking",
            userId: ctx.userId,
            subject: { order },
            allowedActions: ["backToCatalog"],
            issuedAt: now,
            expiresAt: now + 86400
          },
          process.env.TELEFORGE_FLOW_SECRET ?? "dev-secret"
        );
        const miniAppUrl = process.env.MINI_APP_URL ?? "http://localhost:3000";
        const trackingUrl = `${miniAppUrl}?tgWebAppStartParam=${encodeURIComponent(trackingToken)}`;

        return {
          data: { order },
          effects: [{
            type: "chatMessage",
            text: [
              "\uD83D\uDED2 Order confirmed!",
              "",
              `Order #${order.id}`,
              "",
              items,
              "",
              `Total: $${order.total.toFixed(2)}`,
              "",
              "Thank you for shopping at GadgetShop."
            ].join("\n"),
            replyMarkup: {
              inline_keyboard: [[
                { text: "\uD83D\uDCCD Track Order", web_app: { url: trackingUrl } }
              ]]
            }
          }]
        };
      }
    },

    backToCatalog: {
      handler: async ({ data }) => ({
        data: {
          cart: (data as { cart?: CartItem[] }).cart ?? [],
          products
        }
      })
    }
  }
});
