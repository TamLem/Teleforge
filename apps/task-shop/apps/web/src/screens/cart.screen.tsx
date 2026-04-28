import { defineScreen } from "teleforge/web";

import { ProductImage } from "../components/product-image";
import type { TeleforgeScreenComponentProps } from "teleforge/web";

type CartItem = { productId: string; name: string; price: number; quantity: number; image: string };

function CartScreen({ routeData, appState, runAction, navigate, transitioning }: TeleforgeScreenComponentProps) {
  const cart = ((routeData?.cart ?? appState?.value?.cart ?? []) as CartItem[]);
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

  const handleRemove = async (productId: string) => {
    const result = await runAction("removeFromCart", { productId, cart });
    if (result.data?.cart) appState?.patch({ cart: result.data.cart });
  };

  const handlePlaceOrder = async () => {
    const result = await runAction("placeOrder", { cart });
    if (result.data?.order) {
      navigate("confirmation", { data: { order: result.data.order } });
    }
  };

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">Shopping Cart</p>
        <h1>{cart.length === 0 ? "Your cart is empty" : `${itemCount} item${itemCount !== 1 ? "s" : ""}`}</h1>
      </header>

      {cart.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>Browse our catalog to add products.</p>
          <button className="btn-primary" onClick={() => navigate("catalog")}>Browse Catalog</button>
        </div>
      ) : (
        <>
          {cart.map((item) => (
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
            <button disabled={transitioning} onClick={() => navigate("catalog")}>Continue Shopping</button>
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
