import React from "react";
import ReactDOM from "react-dom/client";
import { TeleforgeMiniApp, createFetchMiniAppServerBridge } from "teleforge/web";
import "./styles.css";

import cartScreen from "./screens/cart.screen.js";
import catalogScreen from "./screens/catalog.screen.js";
import confirmationScreen from "./screens/confirmation.screen.js";
import detailScreen from "./screens/product-detail.screen.js";
import { flowManifest } from "./teleforge-generated/client-flow-manifest.js";

const serverBridge = createFetchMiniAppServerBridge();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TeleforgeMiniApp
      flowManifest={flowManifest}
      screens={[catalogScreen, detailScreen, cartScreen, confirmationScreen]}
      serverBridge={serverBridge}
    />
  </React.StrictMode>
);
