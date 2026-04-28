import assert from "node:assert/strict";
import test from "node:test";

import gadgetshopFlow from "../src/flows/gadgetshop.flow.ts";

test("gadgetshop flow declares /shop command", () => {
  assert.equal(gadgetshopFlow.command?.command, "shop");
  assert.equal(gadgetshopFlow.command?.description, "Browse and shop electronics");
  assert.equal(typeof gadgetshopFlow.command?.handler, "function");
});

test("gadgetshop flow has miniApp routes configured", () => {
  assert.ok(gadgetshopFlow.miniApp);
  assert.equal(gadgetshopFlow.miniApp?.routes["/"], "catalog");
  assert.equal(gadgetshopFlow.miniApp?.routes["/cart"], "cart");
  assert.equal(gadgetshopFlow.miniApp?.routes["/confirmation"], "confirmation");
  assert.equal(gadgetshopFlow.miniApp?.defaultRoute, "/");
  assert.equal(gadgetshopFlow.miniApp?.title, "GadgetShop");
});

test("gadgetshop flow has all actions registered", () => {
  assert.ok(gadgetshopFlow.actions);
  const ids = Object.keys(gadgetshopFlow.actions!);
  assert.ok(ids.includes("addToCart"));
  assert.ok(ids.includes("removeFromCart"));
  assert.ok(ids.includes("viewDetail"));
  assert.ok(ids.includes("viewCart"));
  assert.ok(ids.includes("placeOrder"));
  assert.ok(ids.includes("backToCatalog"));
});

test("addToCart returns cart without navigate", async () => {
  const result = await gadgetshopFlow.actions!.addToCart.handler({
    ctx: { appId: "test", flowId: "gadgetshop", userId: "u1", issuedAt: 0, expiresAt: Date.now() + 90000 },
    data: { productId: "iphone-15", qty: 1, cart: [] },
    services: null
  });

  assert.equal(result.navigate, undefined, "addToCart should not have navigate");
  assert.ok(result.data);
  const d = result.data as Record<string, unknown>;
  assert.equal(d.justAdded, "iPhone 15 Pro");
  assert.ok(Array.isArray(d.cart));
  assert.equal((d.cart as Array<unknown>).length, 1);
});

test("placeOrder creates order without navigate", async () => {
  const cart = [{ productId: "iphone-15", name: "iPhone 15 Pro", price: 999, quantity: 1, image: "📱" }];
  const result = await gadgetshopFlow.actions!.placeOrder.handler({
    ctx: { appId: "test", flowId: "gadgetshop", userId: "u1", issuedAt: 0, expiresAt: Date.now() + 90000 },
    data: { cart },
    services: null
  });

  assert.equal(result.navigate, undefined, "placeOrder should not have navigate");
  assert.ok(result.data);
  const d = result.data as Record<string, unknown>;
  assert.ok(d.order, "order should exist");
  assert.equal((d.order as Record<string, unknown>).status, "confirmed");
});

test("addToCart rejects unknown product gracefully", async () => {
  const result = await gadgetshopFlow.actions!.addToCart.handler({
    ctx: { appId: "test", flowId: "gadgetshop", userId: "u1", issuedAt: 0, expiresAt: Date.now() + 90000 },
    data: { productId: "nonexistent", cart: [] },
    services: null
  });

  assert.ok(result.data);
  assert.equal((result.data as Record<string, unknown>).error, "Product not found");
});
