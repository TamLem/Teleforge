import {
  defineCoordinationConfig,
  flowCoordination,
  routeCoordination
} from "@teleforge/core/browser";

export const taskShopCoordination = defineCoordinationConfig({
  defaults: {
    expiryMinutes: 60,
    persistence: "session",
    returnToChat: {
      stayInChat: true,
      text: "Back to Task Shop chat"
    }
  },
  entryPoints: {
    buttons: {
      open_task_shop: {
        route: "/",
        text: "Open Task Shop"
      }
    },
    commands: {
      start: {
        description: "Open the Task Shop Mini App",
        route: "/"
      }
    }
  },
  flows: {
    "task-shop-browse": flowCoordination("task-shop-browse", {
      defaultStep: "catalog",
      finalStep: "completed",
      onComplete: "return_to_chat",
      steps: ["catalog", "cart", "checkout", "completed"]
    })
  },
  routes: {
    "/": routeCoordination("/", {
      entryPoints: [
        { command: "start", type: "bot_command" },
        { text: "Open Task Shop", type: "bot_button" }
      ],
      flowId: "task-shop-browse",
      stepRoutes: {
        cart: "/cart",
        catalog: "/",
        checkout: "/checkout",
        completed: "/success"
      }
    })
  }
});
