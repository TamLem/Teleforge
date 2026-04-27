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
          "/confirmation": "confirmation"
        },
        "title": "GadgetShop"
      },
      "screens": [
        {
          "actions": [
            "addToCart",
            "removeFromCart",
            "viewDetail",
            "viewCart",
            "placeOrder",
            "backToCatalog"
          ],
          "id": "catalog",
          "route": "/"
        },
        {
          "actions": [
            "addToCart",
            "removeFromCart",
            "viewDetail",
            "viewCart",
            "placeOrder",
            "backToCatalog"
          ],
          "id": "product-detail",
          "route": "/product/:id"
        },
        {
          "actions": [
            "addToCart",
            "removeFromCart",
            "viewDetail",
            "viewCart",
            "placeOrder",
            "backToCatalog"
          ],
          "id": "cart",
          "route": "/cart"
        },
        {
          "actions": [
            "addToCart",
            "removeFromCart",
            "viewDetail",
            "viewCart",
            "placeOrder",
            "backToCatalog"
          ],
          "id": "confirmation",
          "route": "/confirmation"
        }
      ]
    }
  ]
}
);
