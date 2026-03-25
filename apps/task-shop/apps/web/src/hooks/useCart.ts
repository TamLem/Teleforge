import { useEffect, useMemo, useState } from "react";

import type { CartItem, OrderPayload, Task } from "@task-shop/types";

const CART_STORAGE_KEY = "task-shop.cart";
const LAST_ORDER_STORAGE_KEY = "task-shop.last-order";

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(() => readCartItems());
  const [lastOrder, setLastOrder] = useState<OrderPayload | null>(() => readLastOrder());

  useEffect(() => {
    writeJson(CART_STORAGE_KEY, items);
  }, [items]);

  useEffect(() => {
    writeJson(LAST_ORDER_STORAGE_KEY, lastOrder);
  }, [lastOrder]);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );
  const count = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  return {
    addItem(task: Task) {
      setItems((current) => {
        const existing = current.find((item) => item.id === task.id);
        if (!existing) {
          return [
            ...current,
            {
              ...task,
              quantity: 1
            }
          ];
        }

        return current.map((item) =>
          item.id === task.id
            ? {
                ...item,
                quantity: item.quantity + 1
              }
            : item
        );
      });
    },
    clearCart() {
      setItems([]);
    },
    completeOrder(payload: OrderPayload) {
      setLastOrder(payload);
      setItems([]);
    },
    count,
    items,
    lastOrder,
    removeItem(taskId: string) {
      setItems((current) =>
        current.flatMap((item) => {
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
        })
      );
    },
    total
  };
}

function readCartItems(): CartItem[] {
  return readJson<CartItem[]>(CART_STORAGE_KEY, []);
}

function readLastOrder(): OrderPayload | null {
  return readJson<OrderPayload | null>(LAST_ORDER_STORAGE_KEY, null);
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}
