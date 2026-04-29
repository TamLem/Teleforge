import { defineScreen } from "teleforge/web";

import { ProductImage } from "../components/product-image";

import type { CartScreenProps } from "../teleforge-generated/contracts";

function CartScreen({ loader, loaderData, actions, nav, transitioning }: CartScreenProps) {
  if (loader.status === "loading") return <main className="shell"><div className="card"><h2>Loading...</h2></div></main>;
  if (loader.status === "error") return <main className="shell"><div className="card"><h2>Failed to load cart</h2></div></main>;

  const items = loaderData?.items ?? [];
  const subtotal = loaderData?.subtotal ?? 0;
  const itemCount = loaderData?.itemCount ?? 0;

  const handleRemove = async (productId: string) => {
    await actions.removeFromCart({ productId });
  };

  const handlePlaceOrder = async () => {
    const result = await actions.placeOrder();
    if (result.data?.placed) {
      nav.confirmation();
    }
  };

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">Shopping Cart</p>
        <h1>{items.length === 0 ? "Your cart is empty" : `${itemCount} item${itemCount !== 1 ? "s" : ""}`}</h1>
      </header>

      {items.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>Browse our catalog to add products.</p>
          <button className="btn-primary" onClick={() => nav.catalog()}>Browse Catalog</button>
        </div>
      ) : (
        <>
          {items.map((item) => (
            <div key={item.productId} className="card">
              <div className="line-item">
                <ProductImage className="line-thumb" image={item.image} alt={item.name} />
                <div className="details">
                  <h3>{item.name}</h3>
                  <p>${item.price} each</p>
                  <p><strong>Qty: {item.quantity}</strong>{" · "}<span className="price">${(item.price * item.quantity).toFixed(2)}</span></p>
                </div>
                <button className="btn-danger btn-small" disabled={transitioning} onClick={() => handleRemove(item.productId)}>Remove</button>
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
            <button disabled={transitioning} onClick={() => nav.catalog()}>Continue Shopping</button>
            <button className="btn-primary" disabled={transitioning} onClick={handlePlaceOrder}>Place Order</button>
          </div>
        </>
      )}
    </main>
  );
}

export default defineScreen({
  component: CartScreen,
  id: "cart",
  title: "Cart"
});
