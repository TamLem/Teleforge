import React from "react";
import ReactDOM from "react-dom/client";
import { TeleforgeMiniApp } from "teleforge/web";

import startFlow from "../../bot/src/flows/start.flow.js";

import homeScreen from "./screens/home.screen.js";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TeleforgeMiniApp flows={[startFlow]} screens={[homeScreen]} />
  </React.StrictMode>
);
