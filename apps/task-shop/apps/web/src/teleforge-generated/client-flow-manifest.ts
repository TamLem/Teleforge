import { defineClientFlowManifest } from "teleforge/web";

export const flowManifest = defineClientFlowManifest(
  {
  "flows": [
    {
      "id": "gadgetshop",
      "miniApp": {
        "defaultRoute": "/",
        "routes": {
          "/": "catalog",
          "/product/:id": "product-detail",
          "/cart": "cart",
          "/confirmation": "confirmation",
          "/tracking": "tracking"
        },
        "title": "GadgetShop"
      },
      "screens": [
        {
          "actions": [
            "addToCart",
            "removeFromCart",
            "placeOrder"
          ],
          "id": "catalog",
          "route": "/"
        },
        {
          "actions": [
            "addToCart",
            "removeFromCart",
            "placeOrder"
          ],
          "id": "product-detail",
          "route": "/product/:id"
        },
        {
          "actions": [
            "addToCart",
            "removeFromCart",
            "placeOrder"
          ],
          "id": "cart",
          "route": "/cart"
        },
        {
          "actions": [
            "addToCart",
            "removeFromCart",
            "placeOrder"
          ],
          "id": "confirmation",
          "route": "/confirmation"
        },
        {
          "actions": [
            "addToCart",
            "removeFromCart",
            "placeOrder"
          ],
          "id": "tracking",
          "route": "/tracking"
        }
      ]
    },
    {
      "id": "gadgetshop-start",
      "screens": []
    }
  ]
}
);
