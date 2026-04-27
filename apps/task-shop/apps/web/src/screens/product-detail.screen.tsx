import { useState } from "react";
import { defineScreen } from "teleforge/web";

import type { CartItem, Product } from "@task-shop/types";
import type { TeleforgeScreenComponentProps } from "teleforge/web";

interface DetailData {
  product?: Product;
  cart?: CartItem[];
}

function ProductDetailScreen({ data, runAction, transitioning }: TeleforgeScreenComponentProps<DetailData>) {
  const screenData = data as DetailData;
  const product = screenData?.product;
  const cart = screenData?.cart ?? [];
  const [qty, setQty] = useState(1);

  if (!product) {
    return (
      <main className="shell">
        <div className="card"><h2>Product not found</h2></div>
      </main>
    );
  }

  const inCart = cart.filter((i) => i.productId === product.id).reduce((s, i) => s + i.quantity, 0);

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">{product.category}</p>
        <h1>{product.name}</h1>
      </header>

      <div className="text-center" style={{ fontSize: "4rem", padding: "0.5rem" }}>
        {product.image}
      </div>

      <div className="card">
        <p className="lede">{product.description}</p>
        <p className="price-lg">${product.price}</p>
        {!product.inStock && <span className="badge" style={{ background: "#ffebee", color: "#c62828" }}>Out of stock</span>}
      </div>

      <div className="card">
        <h2>Specifications</h2>
        <div className="specs-grid">
          {Object.entries(product.specs).map(([key, value]) => (
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
          <button
            className="btn-primary"
            disabled={transitioning}
            onClick={() => runAction("addToCart", { productId: product.id, qty, cart })}
          >
            Add to Cart — ${(product.price * qty).toFixed(2)}
          </button>
          {inCart > 0 && <span className="muted small">{inCart} already in cart</span>}
        </div>
      )}

      <div className="actions-row">
        <button onClick={() => runAction("backToCatalog", { cart })}>Back to Catalog</button>
        <button className="btn-primary" onClick={() => runAction("viewCart", { cart })}>
          View Cart ({cart.reduce((s, i) => s + i.quantity, 0)})
        </button>
      </div>
    </main>
  );
}

export default defineScreen<DetailData>({
  component: ProductDetailScreen,
  id: "product-detail",
  title: "Product Details"
});
