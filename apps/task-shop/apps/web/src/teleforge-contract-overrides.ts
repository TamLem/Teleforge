export interface TeleforgeActionPayloadOverrides {
  gadgetshop: {
    addToCart: { productId: string; qty: number };
    removeFromCart: { productId: string };
    placeOrder: undefined;
  };
}
