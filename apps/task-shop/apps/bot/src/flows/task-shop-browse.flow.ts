import {
  addTaskToCart,
  createOrderFromCart,
  removeTaskFromCart,
  type TaskShopFlowState,
  type TaskShopSubmitPayload
} from "@task-shop/types";
import { defineFlow } from "teleforge/web";

const INITIAL_STATE: TaskShopFlowState = {
  cart: [],
  lastOrder: null
};

export default defineFlow<TaskShopFlowState, unknown>({
  id: "task-shop-browse",
  initialStep: "catalog",
  finalStep: "completed",
  state: INITIAL_STATE,
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
      success: "/success"
    },
    title: "Task Shop"
  },
  steps: {
    catalog: {
      async onSubmit({ data, state }) {
        return resolveCatalogSubmit(state, data);
      },
      screen: "task-shop.catalog",
      type: "miniapp"
    },
    cart: {
      async onSubmit({ data, state }) {
        return resolveCartSubmit(state, data);
      },
      screen: "task-shop.cart",
      type: "miniapp"
    },
    checkout: {
      async onSubmit({ data, state }) {
        return resolveCheckoutSubmit(state, data);
      },
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
      async onSubmit({ data, state }) {
        return resolveSuccessSubmit(state, data);
      },
      screen: "task-shop.success",
      type: "miniapp"
    },
    completed: {
      message: ({ state }) =>
        state.lastOrder
          ? [
              "Task Shop order confirmed.",
              `Items: ${state.lastOrder.items.length}`,
              `Total: ${state.lastOrder.total} ${state.lastOrder.currency}`
            ].join("\n")
          : "Task Shop flow complete.",
      type: "chat"
    }
  }
});

function resolveCatalogSubmit(state: TaskShopFlowState, payload: unknown) {
  const data = payload as TaskShopSubmitPayload;

  switch (data.type) {
    case "add-item":
      return {
        state: {
          ...state,
          cart: addTaskToCart(state.cart, data.taskId)
        }
      };
    case "go-to-cart":
      return {
        to: "cart"
      };
    case "go-to-checkout":
      return {
        to: "checkout"
      };
    default:
      return undefined;
  }
}

function resolveCartSubmit(state: TaskShopFlowState, payload: unknown) {
  const data = payload as TaskShopSubmitPayload;

  switch (data.type) {
    case "remove-item":
      return {
        state: {
          ...state,
          cart: removeTaskFromCart(state.cart, data.taskId)
        }
      };
    case "browse":
      return {
        to: "catalog"
      };
    case "go-to-checkout":
      return {
        to: state.cart.length > 0 ? "checkout" : "catalog"
      };
    default:
      return undefined;
  }
}

function resolveCheckoutSubmit(state: TaskShopFlowState, payload: unknown) {
  const data = payload as TaskShopSubmitPayload;

  switch (data.type) {
    case "browse":
      return {
        to: "catalog"
      };
    case "complete-order": {
      if (state.cart.length === 0) {
        return {
          to: "catalog"
        };
      }

      return {
        state: {
          cart: [],
          lastOrder: createOrderFromCart(state.cart)
        },
        to: "success"
      };
    }
    default:
      return undefined;
  }
}

function resolveSuccessSubmit(state: TaskShopFlowState, payload: unknown) {
  const data = payload as TaskShopSubmitPayload;

  if (data.type !== "start-over") {
    return undefined;
  }

  return {
    state: {
      cart: [],
      lastOrder: null
    },
    to: "catalog"
  };
}
