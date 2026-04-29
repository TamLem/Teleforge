import { useState } from "react";
import { defineScreen } from "teleforge/web";

import { ProductImage } from "../components/product-image";

import type { ProductDetailScreenProps } from "../teleforge-generated/contracts";

function ProductDetailScreen({
  loader,
  loaderData,
  actions,
  nav,
  transitioning
}: ProductDetailScreenProps) {
  if (loader.status === "loading")
    return (
      <main className="shell">
        <div className="card">
          <h2>Loading...</h2>
        </div>
      </main>
    );
  if (loader.status === "error")
    return (
      <main className="shell">
        <div className="card">
          <h2>Failed to load product</h2>
        </div>
      </main>
    );
  if (loader.status !== "ready")
    return (
      <main className="shell">
        <div className="card">
          <h2>Loading...</h2>
        </div>
      </main>
    );

  const product = loaderData?.product;

  if (!product || loaderData?.notFound) {
    return (
      <main className="shell">
        <div className="card">
          <h2>Product not found</h2>
        </div>
      </main>
    );
  }

  const productId = product.id;
  const [qty, setQty] = useState(1);

  const handleAddToCart = async () => {
    await actions.addToCart({ productId, qty });
  };

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">{product.category}</p>
        <h1>{product.name}</h1>
      </header>

      <div className="product-hero-image">
        <ProductImage
          className="large"
          image={product.image}
          alt={product.name}
        />
      </div>

      <div className="card">
        <p className="lede">{product.description}</p>
        <p className="price-lg">${product.price}</p>
        {!product.inStock && (
          <span className="badge" style={{ background: "#ffebee", color: "#c62828" }}>
            Out of stock
          </span>
        )}
      </div>

      <div className="card">
        <h2>Specifications</h2>
        <div className="specs-grid">
          {Object.entries(product.specs ?? {}).map(([key, value]) => (
            <div key={key} className="spec-row">
              <span className="label">{key}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </div>

      {Boolean(product.inStock) && (
        <div
          className="card"
          style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}
        >
          <div className="qty-picker">
            <button onClick={() => setQty(Math.max(1, qty - 1))}>-</button>
            <span>{qty}</span>
            <button onClick={() => setQty(qty + 1)}>+</button>
          </div>
          <button className="btn-primary" disabled={transitioning} onClick={handleAddToCart}>
            Add to Cart — ${((product.price as number) * qty).toFixed(2)}
          </button>
        </div>
      )}

      <div className="actions-row">
        <button onClick={() => nav.catalog()}>Back to Catalog</button>
        <button className="btn-primary" onClick={() => nav.cart()}>
          View Cart
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
