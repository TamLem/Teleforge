import { defineTeleforgeApp } from "teleforge";

export default defineTeleforgeApp({
  app: {
    id: "starter-app",
    name: "Starter App",
    version: "1.0.0"
  },
  flows: {
    root: "apps/bot/src/flows"
  },
  runtime: {
    build: {
      outDir: "dist",
      basePath: "/"
    }
  },
  bot: {
    username: "starter_app_bot",
    tokenEnv: "BOT_TOKEN",
    webhook: {
      path: "/api/webhook",
      secretEnv: "WEBHOOK_SECRET"
    }
  },
  miniApp: {
    entry: "apps/web/src/main.tsx",
    launchModes: ["inline", "compact", "fullscreen"],
    defaultMode: "inline",
    capabilities: ["read_access"]
  }
});
