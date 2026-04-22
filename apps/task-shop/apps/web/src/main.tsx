import React from "react";
import ReactDOM from "react-dom/client";
import { TeleforgeMiniApp, createFetchMiniAppServerBridge } from "teleforge/web";

import shopCatalogueFlow from "../../bot/src/flows/shop-catalogue.flow.js";
import taskShopBrowseFlow from "../../bot/src/flows/task-shop-browse.flow.js";

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
      flows={[taskShopBrowseFlow, shopCatalogueFlow]}
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
