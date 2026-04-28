import { defineScreen } from "teleforge/web";

import { ProductImage } from "../components/product-image";

import type { TeleforgeScreenComponentProps } from "teleforge/web";

function ConfirmationScreen({ routeData, navigate }: TeleforgeScreenComponentProps) {
  const order = routeData?.order as Record<string, unknown> | undefined;

  if (!order) {
    return (
      <main className="shell">
        <div className="card"><h2>Order not found</h2></div>
      </main>
    );
  }

  const items = order.items as Array<{ productId: string; name: string; price: number; quantity: number; image: string }>;
  const total = order.total as number;

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">Order Confirmed</p>
        <h1>Thank you!</h1>
        <p className="lede">Your order has been placed successfully.</p>
      </header>

      <div className="order-section">
        <h2 style={{ margin: "0 0 0.5rem" }}>Order #{order.id as string}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {new Date(order.createdAt as string).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className="card">
        <h2>Order Summary</h2>
        {items.map((item) => (
          <div key={item.productId} className="line-item" style={{ borderBottom: "1px solid #f0f2f5", paddingBottom: "0.5rem" }}>
            <ProductImage className="line-thumb" image={item.image} alt={item.name} />
            <div className="details">
              <p><strong>{item.name}</strong></p>
              <p className="muted">Qty: {item.quantity} × ${item.price}</p>
            </div>
            <span className="price">${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
        <div className="total-row">
          <span>Total</span>
          <span style={{ fontSize: "1.25rem" }}>${total.toFixed(2)}</span>
        </div>
      </div>

      <div className="actions-row">
        <button onClick={() => navigate("tracking", { data: { order } })}>
          Track Order
        </button>
        <button className="btn-primary" onClick={() => navigate("catalog")}>
          Continue Shopping
        </button>
      </div>
    </main>
  );
}

export default defineScreen({
  component: ConfirmationScreen,
  id: "confirmation",
  title: "Order Confirmed"
});
