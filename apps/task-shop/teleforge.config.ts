import { defineTeleforgeApp } from "teleforge";

export default defineTeleforgeApp({
  app: {
    id: "task-shop",
    name: "Task Shop",
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
    username: "task_shop_bot",
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
    capabilities: ["read_access", "write_access", "payments"]
  },
  dev: {
    services: [
      {
        name: "bot",
        command: "pnpm --filter @task-shop/bot dev"
      }
    ]
  }
});
