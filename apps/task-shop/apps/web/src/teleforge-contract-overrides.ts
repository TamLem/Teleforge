import type { CartData, CatalogData, Order, Product } from "@task-shop/types";

export interface TeleforgeActionPayloadOverrides {
  gadgetshop: {
    addToCart: { productId: string; qty: number };
    removeFromCart: { productId: string };
    placeOrder: undefined;
  };
}

export interface TeleforgeLoaderDataOverrides {
  gadgetshop: {
    catalog: CatalogData;
    "product-detail": { product?: Product; notFound?: boolean };
    cart: CartData;
    confirmation: { order?: Order };
    tracking: { order?: Order };
  };
}
