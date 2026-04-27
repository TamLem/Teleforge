import { defineScreen } from "teleforge/web";

import type { CartItem, Product } from "@task-shop/types";
import type { TeleforgeScreenComponentProps } from "teleforge/web";

interface CatalogData {
  products?: Product[];
  cart?: CartItem[];
  itemCount?: number;
  justAdded?: string;
}

const CATEGORIES = ["Phones", "Laptops", "Tablets", "Audio", "Accessories"] as const;

function CatalogScreen({ data, runAction, transitioning }: TeleforgeScreenComponentProps<CatalogData>) {
  const screenData = data as CatalogData;
  const products = screenData?.products ?? [];
  const cart = screenData?.cart ?? [];
  const itemCount = screenData?.itemCount ?? 0;

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">GadgetShop</p>
        <h1>Latest Tech</h1>
        <p className="lede">Smartphones, laptops, audio, and accessories</p>
      </header>

      <div className="top-bar">
        <button className={`btn-primary${itemCount === 0 ? " btn-ghost" : ""}`} onClick={() => runAction("viewCart", { cart })}>
          Cart ({itemCount})
        </button>
      </div>

      {screenData?.justAdded && (
        <div className="card card-highlight">
          <p style={{ margin: 0 }}>Added {screenData.justAdded} to cart</p>
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
                    <span className="icon">{product.image}</span>
                    <div className="info">
                      <h3>{product.name}</h3>
                      <p>{product.description}</p>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.25rem" }}>
                        <span className="price">${product.price}</span>
                        {!product.inStock && <span className="badge" style={{ background: "#ffebee", color: "#c62828" }}>Out of stock</span>}
                      </div>
                    </div>
                    <div className="actions">
                      <button className="btn-small" onClick={() => runAction("viewDetail", { productId: product.id, cart })}>
                        Details
                      </button>
                      {product.inStock && (
                        <button
                          className="btn-primary btn-small"
                          disabled={transitioning}
                          onClick={() => runAction("addToCart", { productId: product.id, qty: 1, cart })}
                        >
                          + Add
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

export default defineScreen<CatalogData>({
  component: CatalogScreen,
  id: "catalog",
  title: "GadgetShop"
});
