import { defineClientFlowManifest } from "teleforge/web";

export const flowManifest = defineClientFlowManifest({
  flows: [
    {
      id: "gadgetshop",
      miniApp: {
        defaultRoute: "/",
        routes: {
          "/": "catalog",
          "/product/:id": "product-detail",
          "/cart": "cart",
          "/confirmation": "confirmation",
          "/tracking": "tracking"
        },
        title: "GadgetShop"
      },
      screens: [
        {
          actions: ["addToCart", "removeFromCart", "placeOrder"],
          id: "catalog",
          requiresSession: true,
          route: "/"
        },
        {
          actions: ["addToCart", "removeFromCart", "placeOrder"],
          id: "product-detail",
          requiresSession: true,
          route: "/product/:id"
        },
        {
          actions: ["addToCart", "removeFromCart", "placeOrder"],
          id: "cart",
          requiresSession: true,
          route: "/cart"
        },
        {
          actions: ["addToCart", "removeFromCart", "placeOrder"],
          id: "confirmation",
          requiresSession: true,
          route: "/confirmation"
        },
        {
          actions: ["addToCart", "removeFromCart", "placeOrder"],
          id: "tracking",
          requiresSession: true,
          route: "/tracking"
        }
      ]
    },
    {
      id: "gadgetshop-start",
      screens: []
    }
  ]
});
