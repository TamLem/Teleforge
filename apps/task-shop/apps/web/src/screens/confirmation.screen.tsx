import { defineScreen } from "teleforge/web";

import type { Order } from "@task-shop/types";
import type { TeleforgeScreenComponentProps } from "teleforge/web";

interface ConfirmationData {
  order?: Order;
}

function ConfirmationScreen({ data, runAction }: TeleforgeScreenComponentProps<ConfirmationData>) {
  const screenData = data as ConfirmationData;
  const order = screenData?.order;

  if (!order) {
    return (
      <main className="shell">
        <div className="card"><h2>Order not found</h2></div>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">Order Confirmed</p>
        <h1>Thank you!</h1>
        <p className="lede">Your order has been placed successfully.</p>
      </header>

      <div className="order-section">
        <h2 style={{ margin: "0 0 0.5rem" }}>Order #{order.id}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {new Date(order.createdAt).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className="card">
        <h2>Order Summary</h2>
        {order.items.map((item) => (
          <div key={item.productId} className="line-item" style={{ borderBottom: "1px solid #f0f2f5", paddingBottom: "0.5rem" }}>
            <span style={{ fontSize: "1.5rem" }}>{item.image}</span>
            <div className="details">
              <p><strong>{item.name}</strong></p>
              <p className="muted">Qty: {item.quantity} × ${item.price}</p>
            </div>
            <span className="price">${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
        <div className="total-row">
          <span>Total</span>
          <span style={{ fontSize: "1.25rem" }}>${order.total.toFixed(2)}</span>
        </div>
      </div>

      <div className="actions-row">
        <button
          className="btn-primary"
          style={{ width: "100%" }}
          onClick={() => runAction("backToCatalog", { cart: [] })}
        >
          Continue Shopping
        </button>
      </div>
    </main>
  );
}

export default defineScreen<ConfirmationData>({
  component: ConfirmationScreen,
  id: "confirmation",
  title: "Order Confirmed"
});
