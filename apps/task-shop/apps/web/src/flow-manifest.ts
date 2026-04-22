import { mockTasks, type TaskShopFlowState } from "@task-shop/types";
import { defineClientFlowManifest } from "teleforge/web";

interface ShopCatalogueState {
  orderId: string | null;
  selectedItem: string | null;
}

const initialTaskShopState: TaskShopFlowState = {
  cart: [],
  lastOrder: null,
  selectedTaskId: null
};

export const flowManifest = defineClientFlowManifest([
  {
    id: "task-shop-browse",
    initialStep: "catalog",
    finalStep: "completed",
    state: initialTaskShopState,
    bot: {
      command: {
        buttonText: "Open Task Shop",
        command: "start",
        description: "Open the Task Shop Mini App",
        text: "Welcome to Task Shop. Browse Teleforge-flavored tasks and check out from the Mini App."
      }
    },
    miniApp: {
      launchModes: ["inline", "compact", "fullscreen"],
      requestWriteAccess: true,
      returnToChat: {
        stayInChat: true,
        text: "Back to Task Shop chat"
      },
      route: "/",
      stepRoutes: {
        cart: "/cart",
        checkout: "/checkout",
        detail: "/detail",
        success: "/success"
      },
      title: "Task Shop"
    },
    steps: {
      catalog: {
        screen: "task-shop.catalog",
        type: "miniapp"
      },
      detail: {
        screen: "task-shop.detail",
        type: "miniapp"
      },
      cart: {
        screen: "task-shop.cart",
        type: "miniapp"
      },
      checkout: {
        screen: "task-shop.checkout",
        type: "miniapp"
      },
      success: {
        actions: [
          {
            id: "return-to-chat",
            label: "Return to chat",
            to: "completed"
          }
        ],
        screen: "task-shop.success",
        type: "miniapp"
      },
      completed: {
        message: "Task Shop flow complete.",
        type: "chat"
      }
    }
  },
  {
    id: "shop-catalogue",
    initialStep: "catalogue",
    finalStep: "tracking",
    state: {
      orderId: null,
      selectedItem: null
    } satisfies ShopCatalogueState,
    bot: {
      command: {
        buttonText: "Open Shop",
        command: "shop",
        description: "Browse the shop catalogue",
        text: "Welcome to the Shop! Select an item below."
      }
    },
    miniApp: {
      launchModes: ["inline", "compact", "fullscreen"],
      returnToChat: {
        stayInChat: true,
        text: "Back to Shop"
      },
      route: "/shop",
      stepRoutes: {
        checkout: "/shop/checkout",
        tracking: "/shop/tracking"
      },
      title: "Shop"
    },
    steps: {
      catalogue: {
        actions: mockTasks.map((task) => ({
          id: task.id,
          label: `${task.title} - ${task.price} Stars`,
          miniApp: { payload: { selectedItem: task.id } },
          to: "checkout"
        })),
        message: "Select an item to purchase:",
        type: "chat"
      },
      checkout: {
        screen: "shop.checkout",
        type: "miniapp"
      },
      confirmed: {
        actions: [
          {
            label: "Track Order",
            miniApp: { payload: {} },
            to: "tracking"
          }
        ],
        message: "Order confirmed.",
        miniApp: {
          screen: "shop.tracking"
        },
        type: "chat"
      },
      tracking: {
        screen: "shop.tracking",
        type: "miniapp"
      }
    }
  }
]);
