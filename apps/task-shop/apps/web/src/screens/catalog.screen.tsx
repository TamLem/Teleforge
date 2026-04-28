import { useState } from "react";
import { defineScreen } from "teleforge/web";

import { ProductImage } from "../components/product-image";

import type { Product } from "@task-shop/types";
import type { TeleforgeScreenComponentProps } from "teleforge/web";

const CATEGORIES = ["Phones", "Laptops", "Tablets", "Audio", "Accessories"] as const;

function CatalogScreen({ data, appState, runAction, navigate, transitioning }: TeleforgeScreenComponentProps) {
  const products = (data?.products as Product[]) ?? [];
  const cart = (appState?.value?.cart ?? []) as Array<{ productId: string; quantity: number }>;
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const handleAddToCart = async (productId: string) => {
    const result = await runAction("addToCart", { productId, qty: 1, cart });
    const newCart = result.data?.cart;
    const name = result.data?.justAdded as string | undefined;
    if (newCart) {
      appState?.patch({ cart: newCart });
      setJustAdded(name ?? null);
    }
  };

  const handleViewDetail = async (productId: string) => {
    const result = await runAction("viewDetail", { productId });
    navigate("product-detail", { params: { id: productId }, data: { product: result.data?.product } });
  };

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">GadgetShop</p>
        <h1>Latest Tech</h1>
        <p className="lede">Smartphones, laptops, audio, and accessories</p>
      </header>

      <div className="top-bar">
        <button className={`btn-primary${itemCount === 0 ? " btn-ghost" : ""}`} onClick={() => navigate("cart")}>
          Cart ({itemCount})
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
                      <button className="btn-small" onClick={() => handleViewDetail(product.id)}>Details</button>
                      {product.inStock && (
                        <button className="btn-primary btn-small" disabled={transitioning} onClick={() => handleAddToCart(product.id)}>+ Add</button>
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
