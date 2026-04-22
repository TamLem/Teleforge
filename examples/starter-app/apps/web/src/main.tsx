import React from "react";
import ReactDOM from "react-dom/client";
import { TeleforgeMiniApp } from "teleforge/web";

import { flowManifest } from "./flow-manifest.js";
import homeScreen from "./screens/home.screen.js";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TeleforgeMiniApp flowManifest={flowManifest} screens={[homeScreen]} />
  </React.StrictMode>
);
