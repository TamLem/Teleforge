import { mockTasks, type CartItem, type OrderPayload, type Task } from "@task-shop/types";

export interface MockMiniAppSession {
  addTask: (taskId: string) => void;
  canCheckout: (mode: "inline" | "compact" | "fullscreen") => boolean;
  checkout: () => OrderPayload;
  getItems: () => CartItem[];
  getLastOrder: () => OrderPayload | null;
  getTotal: () => number;
  removeTask: (taskId: string) => void;
  serialize: () => string;
}

export async function openMiniApp(mode: "live" | "mock" = "mock"): Promise<MockMiniAppSession> {
  if (mode === "live") {
    throw new Error("Live browser automation is credential-gated. Use mock mode in CI by default.");
  }

  return createMockMiniAppSession();
}

export function restoreMiniApp(serialized: string): MockMiniAppSession {
  const payload = JSON.parse(serialized) as {
    items?: CartItem[];
    lastOrder?: OrderPayload | null;
  };

  return createMockMiniAppSession(payload.items ?? [], payload.lastOrder ?? null);
}

function createMockMiniAppSession(
  seedItems: CartItem[] = [],
  seedLastOrder: OrderPayload | null = null
): MockMiniAppSession {
  let items = [...seedItems];
  let lastOrder = seedLastOrder;

  return {
    addTask(taskId: string) {
      const task = getTask(taskId);
      const existing = items.find((item) => item.id === taskId);

      if (!existing) {
        items = [
          ...items,
          {
            ...task,
            quantity: 1
          }
        ];
        return;
      }

      items = items.map((item) =>
        item.id === taskId
          ? {
              ...item,
              quantity: item.quantity + 1
            }
          : item
      );
    },
    canCheckout(mode) {
      return mode === "compact" || mode === "fullscreen";
    },
    checkout() {
      const payload: OrderPayload = {
        currency: "Stars",
        items: items.map((item) => ({
          id: item.id,
          price: item.price,
          quantity: item.quantity,
          title: item.title
        })),
        total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
        type: "order_completed"
      };

      lastOrder = payload;
      items = [];
      return payload;
    },
    getItems() {
      return [...items];
    },
    getLastOrder() {
      return lastOrder;
    },
    getTotal() {
      return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    },
    removeTask(taskId: string) {
      items = items.flatMap((item) => {
        if (item.id !== taskId) {
          return [item];
        }

        if (item.quantity <= 1) {
          return [];
        }

        return [
          {
            ...item,
            quantity: item.quantity - 1
          }
        ];
      });
    },
    serialize() {
      return JSON.stringify({
        items,
        lastOrder
      });
    }
  };
}

function getTask(taskId: string): Task {
  const task = mockTasks.find((entry) => entry.id === taskId);

  if (!task) {
    throw new Error(`Unknown task '${taskId}'.`);
  }

  return task;
}
