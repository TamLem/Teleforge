import { AppShell, TgButton, TgText } from "@teleforge/ui";
import { useEffect, useState } from "react";

import { useCart } from "./hooks/useCart";
import { CartPage } from "./pages/CartPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { HomePage } from "./pages/HomePage";
import { SuccessPage } from "./pages/SuccessPage";

type RoutePath = "/" | "/cart" | "/checkout" | "/success";

const knownRoutes: RoutePath[] = ["/", "/cart", "/checkout", "/success"];

export default function App() {
  const cart = useCart();
  const [route, setRoute] = useState<RoutePath>(() => resolveRoute(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => setRoute(resolveRoute(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (pathname: RoutePath) => {
    window.history.pushState({}, "", pathname);
    setRoute(pathname);
  };

  return (
    <AppShell
      header={{
        onBackClick: () => navigate(route === "/checkout" ? "/cart" : "/"),
        showBackButton: route !== "/",
        title: routeTitles[route]
      }}
      style={{
        background:
          "radial-gradient(circle at top left, rgba(255, 200, 87, 0.16), transparent 32%), radial-gradient(circle at top right, rgba(46, 196, 182, 0.14), transparent 36%), linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,248,252,0.98))"
      }}
    >
      <div className="task-shop-shell">
        <nav className="toolbar">
          {knownRoutes.map((path) => (
            <button
              className={path === route ? "toolbar-link toolbar-link--active" : "toolbar-link"}
              key={path}
              onClick={() => navigate(path)}
              type="button"
            >
              {routeTitles[path]}
            </button>
          ))}
        </nav>
        <section className="cart-banner">
          <div>
            <TgText variant="subtitle">Cart snapshot</TgText>
            <TgText variant="hint">
              {cart.count} item(s) in cart · {cart.total} Stars
            </TgText>
          </div>
          <TgButton onClick={() => navigate("/cart")} size="sm" variant="secondary">
            Open cart
          </TgButton>
        </section>
        {route === "/" ? (
          <HomePage cartCount={cart.count} navigate={navigate} onAddToCart={cart.addItem} />
        ) : null}
        {route === "/cart" ? (
          <CartPage
            items={cart.items}
            navigate={navigate}
            onRemove={cart.removeItem}
            total={cart.total}
          />
        ) : null}
        {route === "/checkout" ? (
          <CheckoutPage
            completeOrder={cart.completeOrder}
            items={cart.items}
            navigate={navigate}
            total={cart.total}
          />
        ) : null}
        {route === "/success" ? (
          <SuccessPage lastOrder={cart.lastOrder} navigate={navigate} />
        ) : null}
      </div>
    </AppShell>
  );
}

function resolveRoute(pathname: string): RoutePath {
  return knownRoutes.includes(pathname as RoutePath) ? (pathname as RoutePath) : "/";
}

const routeTitles: Record<RoutePath, string> = {
  "/": "Task Shop",
  "/cart": "Cart",
  "/checkout": "Checkout",
  "/success": "Success"
};
