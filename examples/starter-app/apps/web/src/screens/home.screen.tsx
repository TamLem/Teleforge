import { defineScreen } from "teleforge/web";

import App from "../App.js";

export default defineScreen({
  component() {
    return <App />;
  },
  id: "home",
  title: "Starter Home"
});
