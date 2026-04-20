import { mockTasks } from "@task-shop/types";
import { defineFlow } from "teleforge/web";

interface ShopCatalogueState {
  orderId: string | null;
  selectedItem: string | null;
}

interface ShopSubmitPayload {
  itemId: string;
  type: "complete-order";
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
      checkout: "/shop/checkout"
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
        miniApp: { payload: { itemId: task.id } },
        to: "checkout"
      }))
    },
    checkout: {
      type: "miniapp",
      screen: "shop.checkout",
      async onSubmit({ data, state }) {
        const payload = data as ShopSubmitPayload;
        if (payload.type !== "complete-order") {
          return undefined;
        }

        return {
          state: {
            ...state,
            orderId: `ORD-${Date.now().toString(36).toUpperCase()}`,
            selectedItem: payload.itemId
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
          to: "tracking"
        }
      ]
    },
    tracking: {
      type: "chat",
      message: ({ state }) =>
        [`Order ${state.orderId} is being processed.`, "We'll notify you when it ships."].join("\n")
    }
  }
});
