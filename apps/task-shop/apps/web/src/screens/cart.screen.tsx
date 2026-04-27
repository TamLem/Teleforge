import { defineScreen } from "teleforge/web";

import type { CartItem } from "@task-shop/types";
import type { TeleforgeScreenComponentProps } from "teleforge/web";

interface CartScreenData {
  cart?: CartItem[];
  subtotal?: number;
  itemCount?: number;
}

function CartScreen({ data, runAction, transitioning }: TeleforgeScreenComponentProps<CartScreenData>) {
  const screenData = data as CartScreenData;
  const cart = screenData?.cart ?? [];
  const subtotal = screenData?.subtotal ?? cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const itemCount = screenData?.itemCount ?? cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">Shopping Cart</p>
        <h1>{cart.length === 0 ? "Your cart is empty" : `${itemCount} item${itemCount !== 1 ? "s" : ""}`}</h1>
      </header>

      {cart.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>Browse our catalog to add products.</p>
          <button className="btn-primary" onClick={() => runAction("backToCatalog", { cart })}>
            Browse Catalog
          </button>
        </div>
      ) : (
        <>
          {cart.map((item) => (
            <div key={item.productId} className="card">
              <div className="line-item">
                <span style={{ fontSize: "2rem" }}>{item.image}</span>
                <div className="details">
                  <h3>{item.name}</h3>
                  <p>${item.price} each</p>
                  <p>
                    <strong>Qty: {item.quantity}</strong>
                    {" · "}
                    <span className="price">${(item.price * item.quantity).toFixed(2)}</span>
                  </p>
                </div>
                <button
                  className="btn-danger btn-small"
                  disabled={transitioning}
                  onClick={() => runAction("removeFromCart", { productId: item.productId, cart })}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <div className="card">
            <div className="total-row">
              <span>Total</span>
              <span style={{ fontSize: "1.25rem" }}>${subtotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="actions-row">
            <button disabled={transitioning} onClick={() => runAction("backToCatalog", { cart })}>
              Continue Shopping
            </button>
            <button
              className="btn-primary"
              disabled={transitioning || cart.length === 0}
              onClick={() => runAction("placeOrder", { cart })}
            >
              Place Order
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export default defineScreen<CartScreenData>({
  component: CartScreen,
  id: "cart",
  title: "Cart"
});
