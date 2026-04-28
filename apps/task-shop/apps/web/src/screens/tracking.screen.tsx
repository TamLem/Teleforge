import { defineScreen } from "teleforge/web";

import type { TeleforgeScreenComponentProps } from "teleforge/web";

const STATUS_STEPS = ["confirmed", "processing", "shipped", "delivered"] as const;
const STATUS_LABELS: Record<string, string> = {
  confirmed: "Order Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered"
};

function TrackingScreen({ routeData, navigate }: TeleforgeScreenComponentProps) {
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
  const status = order.status as string;
  const currentIdx = STATUS_STEPS.indexOf(status as typeof STATUS_STEPS[number]);
  const createdAt = order.createdAt as string;

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">Order Tracking</p>
        <h1>Order #{order.id as string}</h1>
        <p className="lede">
          {new Date(createdAt).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </header>

      <div className="card">
        <h2>Status</h2>
        <ol className="timeline">
          {STATUS_STEPS.map((step, idx) => {
            const done = idx < currentIdx;
            const current = idx === currentIdx;
            return (
              <li key={step} className={done ? "done" : current ? "current" : "pending"}>
                <span className="marker" />
                <div>
                  <strong>{STATUS_LABELS[step]}</strong>
                  {done && <p className="muted">Completed</p>}
                  {current && <p>In progress</p>}
                  {!done && !current && <p className="muted">Pending</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="card">
        <h2>Order Summary</h2>
        {items.map((item) => (
          <div key={item.productId} style={{ display: "flex", justifyContent: "space-between", padding: "0.25rem 0" }}>
            <span>{item.image} {item.name} × {item.quantity}</span>
            <span>${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
        <div className="total-row" style={{ marginTop: "0.5rem" }}>
          <span>Total</span>
          <strong>${total.toFixed(2)}</strong>
        </div>
      </div>

      <div className="actions-row">
        <button className="btn-primary" onClick={() => navigate("catalog")}>
          Continue Shopping
        </button>
      </div>
    </main>
  );
}

export default defineScreen({
  component: TrackingScreen,
  id: "tracking",
  title: "Order Tracking"
});
