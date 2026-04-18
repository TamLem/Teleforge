import { defineFlow } from "teleforge/web";

export default defineFlow({
  id: "start",
  initialStep: "home",
  state: {},
  bot: {
    command: {
      buttonText: "Open Starter App",
      command: "start",
      description: "Open the Starter App",
      text: "Starter App is ready. Open the Mini App to inspect Telegram theme, user data, and MainButton behavior."
    }
  },
  miniApp: {
    component: "App",
    launchModes: ["inline", "compact", "fullscreen"],
    route: "/"
  },
  steps: {
    home: {
      screen: "home",
      type: "miniapp"
    }
  }
});
