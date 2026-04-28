import { useState } from "react";
import { defineScreen } from "teleforge/web";

import { ProductImage } from "../components/product-image";
import type { TeleforgeScreenComponentProps } from "teleforge/web";

function ProductDetailScreen({ launchData, routeData, appState, runAction, navigate, transitioning }: TeleforgeScreenComponentProps) {
  const product = (routeData?.product ?? launchData?.product) as Record<string, unknown> | undefined;
  const cart = (appState?.value?.cart ?? []) as Array<{ productId: string; name: string; price: number; quantity: number; image: string }>;
  const [qty, setQty] = useState(1);

  if (!product) {
    return (
      <main className="shell">
        <div className="card"><h2>Product not found</h2></div>
      </main>
    );
  }

  const productId = product.id as string;
  const inCart = cart.filter((i) => i.productId === productId).reduce((s, i) => s + i.quantity, 0);
  const price = product.price as number;

  const handleAddToCart = async () => {
    const result = await runAction("addToCart", { productId, qty, cart });
    if (result.data?.cart) appState?.patch({ cart: result.data.cart });
  };

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">{product.category as string}</p>
        <h1>{product.name as string}</h1>
      </header>

      <div className="product-hero-image">
        <ProductImage className="large" image={product.image as string} alt={product.name as string} />
      </div>

      <div className="card">
        <p className="lede">{product.description as string}</p>
        <p className="price-lg">${price}</p>
        {!product.inStock && <span className="badge" style={{ background: "#ffebee", color: "#c62828" }}>Out of stock</span>}
      </div>

      <div className="card">
        <h2>Specifications</h2>
        <div className="specs-grid">
          {Object.entries(product.specs as Record<string, string> ?? {}).map(([key, value]) => (
            <div key={key} className="spec-row">
              <span className="label">{key}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </div>

      {product.inStock && (
        <div className="card" style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
          <div className="qty-picker">
            <button onClick={() => setQty(Math.max(1, qty - 1))}>-</button>
            <span>{qty}</span>
            <button onClick={() => setQty(qty + 1)}>+</button>
          </div>
          <button className="btn-primary" disabled={transitioning} onClick={handleAddToCart}>
            Add to Cart — ${(price * qty).toFixed(2)}
          </button>
          {inCart > 0 && <span className="muted small">{inCart} already in cart</span>}
        </div>
      )}

      <div className="actions-row">
        <button onClick={() => navigate("catalog")}>Back to Catalog</button>
        <button className="btn-primary" onClick={() => navigate("cart")}>
          View Cart ({cart.reduce((s, i) => s + i.quantity, 0)})
        </button>
      </div>
    </main>
  );
}

export default defineScreen({
  component: ProductDetailScreen,
  id: "product-detail",
  title: "Product Details"
});
