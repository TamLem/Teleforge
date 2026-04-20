import { mockTasks } from "@task-shop/types";
import { defineFlow } from "teleforge/web";

interface ShopCatalogueState {
  orderId: string | null;
  selectedItem: string | null;
}

export default defineFlow<ShopCatalogueState>({
  id: "shop-catalogue",
  initialStep: "catalogue",
  finalStep: "tracking",
  state: {
    orderId: null,
    selectedItem: null
  },
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
      type: "chat",
      message: "Select an item to purchase:",
      actions: mockTasks.map((task) => ({
        id: task.id,
        label: `${task.title} — ${task.price}★`,
        miniApp: { payload: { selectedItem: task.id } },
        to: "checkout"
      }))
    },
    checkout: {
      type: "miniapp",
      screen: "shop.checkout",
      async onSubmit({ data, state }) {
        const payload = data as { itemId?: string; type: string };
        if (payload.type === "select-item" && payload.itemId) {
          return {
            state: {
              ...state,
              selectedItem: payload.itemId
            }
          };
        }
        if (payload.type !== "complete-order") {
          return undefined;
        }

        return {
          state: {
            ...state,
            orderId: `ORD-${Date.now().toString(36).toUpperCase()}`
          },
          to: "confirmed"
        };
      }
    },
    confirmed: {
      type: "chat",
      message: ({ state }) => {
        const item = mockTasks.find((t) => t.id === state.selectedItem);
        return [
          "Order confirmed!",
          "",
          `Item: ${item?.title ?? "Unknown"}`,
          `Price: ${item?.price ?? 0} Stars`,
          `Order: ${state.orderId}`
        ].join("\n");
      },
      actions: [
        {
          label: "Track Order",
          miniApp: { payload: {} },
          to: "tracking"
        }
      ],
      miniApp: {
        screen: "shop.tracking"
      }
    },
    tracking: {
      type: "miniapp",
      screen: "shop.tracking"
    }
  }
});
