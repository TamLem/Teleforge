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
      "/confirmation": "confirmation"
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
        const payload = data as { productId: string; cart?: CartItem[] };
        const product = getProduct(payload.productId);
        if (!product) return { navigate: "catalog", data: { cart: payload.cart, products } };

        return {
          navigate: "product-detail",
          data: { product, cart: payload.cart ?? [] }
        };
      }
    },

    viewCart: {
      handler: async ({ data }) => {
        const cart = (data as { cart?: CartItem[] }).cart ?? [];
        return {
          navigate: "cart",
          data: {
            cart,
            subtotal: getCartSubtotal(cart),
            itemCount: getCartItemCount(cart)
          }
        };
      }
    },

    placeOrder: {
      handler: async ({ data }) => {
        const cart = (data as { cart?: CartItem[] }).cart ?? [];
        if (cart.length === 0) return { navigate: "catalog", data: { cart: [], products } };

        const order = createOrder(cart);

        return {
          navigate: "confirmation",
          data: { order, cart: [] }
        };
      }
    },

    backToCatalog: {
      handler: async ({ data }) => ({
        navigate: "catalog",
        data: {
          cart: (data as { cart?: CartItem[] }).cart ?? [],
          products
        }
      })
    }
  }
});
