import { AppShell, TgButton, TgText } from "@teleforge/ui";
import {
  CoordinationProvider,
  ExpiredFlowView,
  ResumeIndicator,
  useFlowState
} from "@teleforge/web";
import { useEffect, useState } from "react";

import { taskShopCoordination } from "./coordination";
import {
  clearTaskShopFlowState,
  createTaskShopFlowResolver,
  getTaskShopResumeSnapshot,
  persistTaskShopFlowState,
  resolveTaskShopResumeRoute,
  type TaskShopRoute
} from "./flowResume";
import { useCart } from "./hooks/useCart";
import { CartPage } from "./pages/CartPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { HomePage } from "./pages/HomePage";
import { SuccessPage } from "./pages/SuccessPage";

import type { OrderPayload } from "@task-shop/types";

const knownRoutes: TaskShopRoute[] = ["/", "/cart", "/checkout", "/success"];

export default function App() {
  const cart = useCart();
  const [route, setRoute] = useState<TaskShopRoute>(() => resolveRoute(window.location.pathname));
  const flowResolver = createTaskShopFlowResolver();

  useEffect(() => {
    const handlePopState = () => setRoute(resolveRoute(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (pathname: TaskShopRoute, options?: { replace?: boolean }) => {
    if (options?.replace) {
      window.history.replaceState({}, "", pathname);
    } else {
      window.history.pushState({}, "", pathname);
    }

    setRoute(pathname);
  };

  const handleFreshStart = () => {
    clearTaskShopFlowState();
    cart.resetSession();
    navigate("/", { replace: true });
  };

  return (
    <CoordinationProvider
      config={taskShopCoordination}
      currentRoute={route}
      flowSnapshot={{
        items: cart.items,
        lastOrder: cart.lastOrder
      }}
      onFreshStart={handleFreshStart}
      onResume={(result) => {
        cart.hydrateSnapshot(getTaskShopResumeSnapshot(result.flowState));
        navigate(result.redirectTo as TaskShopRoute, { replace: true });
      }}
      persistFlowState={({ payload, route, userId }) =>
        persistTaskShopFlowState({
          items: Array.isArray(payload.items) ? payload.items : [],
          lastOrder:
            payload.lastOrder && typeof payload.lastOrder === "object"
              ? (payload.lastOrder as OrderPayload)
              : null,
          route: resolveRoute(route),
          userId
        })
      }
      resolveRoute={(state) =>
        taskShopCoordination.resolveStepRoute(state.flowId, state.stepId) ??
        resolveTaskShopResumeRoute(state)
      }
      resolver={flowResolver}
    >
      <TaskShopShell
        cart={cart}
        handleFreshStart={handleFreshStart}
        navigate={navigate}
        route={route}
      />
    </CoordinationProvider>
  );
}

function TaskShopShell({
  cart,
  handleFreshStart,
  navigate,
  route
}: {
  cart: ReturnType<typeof useCart>;
  handleFreshStart: () => void;
  navigate: (pathname: TaskShopRoute, options?: { replace?: boolean }) => void;
  route: TaskShopRoute;
}) {
  const flowState = useFlowState();
  const completedSnapshot =
    flowState.error === "completed" && flowState.flowState
      ? getTaskShopResumeSnapshot(flowState.flowState)
      : null;

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
        <ResumeIndicator />
        {flowState.status === "error" ? (
          <ExpiredFlowView error={flowState.error} onFreshStart={handleFreshStart} />
        ) : null}
        {completedSnapshot?.lastOrder ? (
          <section className="cart-banner">
            <div>
              <TgText variant="subtitle">Completed order</TgText>
              <TgText variant="hint">
                {completedSnapshot.lastOrder.items.length} item(s) ·{" "}
                {completedSnapshot.lastOrder.total} {completedSnapshot.lastOrder.currency}
              </TgText>
            </div>
          </section>
        ) : null}
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

function resolveRoute(pathname: string): TaskShopRoute {
  return knownRoutes.includes(pathname as TaskShopRoute) ? (pathname as TaskShopRoute) : "/";
}

const routeTitles: Record<TaskShopRoute, string> = {
  "/": "Task Shop",
  "/cart": "Cart",
  "/checkout": "Checkout",
  "/success": "Success"
};
