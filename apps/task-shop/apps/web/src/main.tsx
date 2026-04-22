import React from "react";
import ReactDOM from "react-dom/client";
import { TeleforgeMiniApp, createFetchMiniAppServerBridge } from "teleforge/web";

import { flowManifest } from "./teleforge-generated/client-flow-manifest.js";
import cartScreen from "./screens/cart.screen.js";
import catalogScreen from "./screens/catalog.screen.js";
import checkoutScreen from "./screens/checkout.screen.js";
import shopCheckoutScreen from "./screens/shop-checkout.screen.js";
import shopTrackingScreen from "./screens/shop-tracking.screen.js";
import successScreen from "./screens/success.screen.js";
import taskDetailScreen from "./screens/task-detail.screen.js";
import "./styles.css";

const serverBridge = createFetchMiniAppServerBridge();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TeleforgeMiniApp
      flowManifest={flowManifest}
      screens={[
        catalogScreen,
        cartScreen,
        checkoutScreen,
        successScreen,
        shopCheckoutScreen,
        shopTrackingScreen,
        taskDetailScreen
      ]}
      serverBridge={serverBridge}
    />
  </React.StrictMode>
);
