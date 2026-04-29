import { useState } from "react";
import { defineScreen } from "teleforge/web";

import { ProductImage } from "../components/product-image";

import type { CatalogScreenProps } from "../teleforge-generated/contracts";

const CATEGORIES = ["Phones", "Laptops", "Tablets", "Audio", "Accessories"] as const;

function CatalogScreen({ loader, loaderData, actions, nav, transitioning }: CatalogScreenProps) {
  if (loader.status === "loading") return <main className="shell"><div className="card"><h2>Loading...</h2></div></main>;
  if (loader.status === "error") return <main className="shell"><div className="card"><h2>Failed to load products</h2></div></main>;
  if (loader.status !== "ready") return <main className="shell"><div className="card"><h2>Loading...</h2></div></main>;

  const products = loaderData?.products ?? [];
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  const handleAddToCart = async (productId: string) => {
    setAddingId(productId);
    try {
      const result = await actions.addToCart({ productId, qty: 1 });
      const name = (result.data?.justAdded as string | undefined);
      if (name) setJustAdded(name);
      setAddingId(null);
    } catch {
      setAddingId(null);
    }
  };

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">GadgetShop</p>
        <h1>Latest Tech</h1>
        <p className="lede">Smartphones, laptops, audio, and accessories</p>
      </header>

      <div className="top-bar">
        <button className="btn-primary" onClick={() => nav.cart()}>
          View Cart
        </button>
      </div>

      {justAdded && (
        <div className="card card-highlight">
          <p style={{ margin: 0 }}>Added {justAdded} to cart</p>
        </div>
      )}

      {CATEGORIES.map((category) => {
        const catProducts = products.filter((p) => p.category === category);
        if (catProducts.length === 0) return null;

        return (
          <div key={category}>
            <p className="category-header">{category}</p>
            <div className="product-grid">
              {catProducts.map((product) => (
                <div key={product.id} className="card">
                  <div className="product-row">
                    <ProductImage className="thumb" image={product.image} alt={product.name} />
                    <div className="info">
                      <h3>{product.name}</h3>
                      <p>{product.description}</p>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.25rem" }}>
                        <span className="price">${product.price}</span>
                        {!product.inStock && <span className="badge" style={{ background: "#ffebee", color: "#c62828" }}>Out of stock</span>}
                      </div>
                    </div>
                    <div className="actions">
                      <button className="btn-small" onClick={() => nav.productDetail({ id: product.id })}>Details</button>
                      {product.inStock && (
                        <button className="btn-primary btn-small" disabled={transitioning || addingId === product.id} onClick={() => handleAddToCart(product.id)}>
                          {addingId === product.id ? "..." : "+ Add"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </main>
  );
}

export default defineScreen({
  component: CatalogScreen,
  id: "catalog",
  title: "GadgetShop"
});
