import React from "react";
import ReactDOM from "react-dom/client";
import { TeleforgeMiniApp } from "teleforge/web";

import taskShopBrowseFlow from "../../bot/src/flows/task-shop-browse.flow.js";

import cartScreen from "./screens/cart.screen.js";
import catalogScreen from "./screens/catalog.screen.js";
import checkoutScreen from "./screens/checkout.screen.js";
import successScreen from "./screens/success.screen.js";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TeleforgeMiniApp
      flows={[taskShopBrowseFlow]}
      screens={[catalogScreen, cartScreen, checkoutScreen, successScreen]}
    />
  </React.StrictMode>
);
