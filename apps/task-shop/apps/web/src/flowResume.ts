import type { CartItem, OrderPayload } from "@task-shop/types";
import type { FlowStateResolver, UserFlowState } from "@teleforge/core/browser";

export type TaskShopRoute = "/" | "/cart" | "/checkout" | "/success";

interface StorageLike {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
}

interface PersistTaskShopFlowInput {
  items: CartItem[];
  lastOrder: OrderPayload | null;
  now?: number;
  route: TaskShopRoute;
  storage?: StorageLike | null;
  userId: string | null;
}

export interface TaskShopResumeSnapshot {
  items: CartItem[];
  lastOrder: OrderPayload | null;
}

const FLOW_ID = "task-shop-browse";
const FLOW_STORAGE_KEY = "task-shop.flow-state";
const FLOW_TTL_MS = 60 * 60 * 1000;

export function clearTaskShopFlowState(storage = getBrowserStorage()) {
  storage?.removeItem(FLOW_STORAGE_KEY);
}

export function createTaskShopFlowResolver(storage = getBrowserStorage()): FlowStateResolver {
  return async (flowId: string) => {
    if (!storage || flowId !== FLOW_ID) {
      return null;
    }

    const state = readTaskShopFlowState(storage);

    if (!state || state.flowId !== flowId) {
      return null;
    }

    return state;
  };
}

export function getTaskShopFlowId() {
  return FLOW_ID;
}

export function getTaskShopResumeSnapshot(flowState: UserFlowState): TaskShopResumeSnapshot {
  const payload = flowState.payload ?? {};

  return {
    items: Array.isArray(payload.items) ? structuredClone(payload.items as CartItem[]) : [],
    lastOrder: isOrderPayload(payload.lastOrder) ? structuredClone(payload.lastOrder) : null
  };
}

export function persistTaskShopFlowState({
  items,
  lastOrder,
  now = Date.now(),
  route,
  storage = getBrowserStorage(),
  userId
}: PersistTaskShopFlowInput): UserFlowState | null {
  if (!storage || !userId) {
    return null;
  }

  const current = readTaskShopFlowState(storage);
  const nextState: UserFlowState = {
    chatId: current?.chatId,
    createdAt: current?.createdAt ?? now,
    expiresAt: now + FLOW_TTL_MS,
    flowId: FLOW_ID,
    payload: {
      items: structuredClone(items),
      lastOrder: lastOrder ? structuredClone(lastOrder) : null,
      route
    },
    stepId: routeToStep(route),
    userId,
    version: (current?.version ?? 0) + 1
  };

  storage.setItem(FLOW_STORAGE_KEY, JSON.stringify(nextState));

  return nextState;
}

export function resolveTaskShopResumeRoute(flowState: UserFlowState): TaskShopRoute | null {
  switch (flowState.stepId) {
    case "catalog":
    case "tasks-reviewed":
      return "/";
    case "cart":
      return "/cart";
    case "checkout":
      return "/checkout";
    case "completed":
      return "/success";
    default:
      return null;
  }
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function isOrderPayload(value: unknown): value is OrderPayload {
  return Boolean(
    value &&
    typeof value === "object" &&
    Array.isArray((value as OrderPayload).items) &&
    typeof (value as OrderPayload).currency === "string" &&
    typeof (value as OrderPayload).total === "number" &&
    typeof (value as OrderPayload).type === "string"
  );
}

function readTaskShopFlowState(storage: StorageLike): UserFlowState | null {
  const raw = storage.getItem(FLOW_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as UserFlowState;
  } catch {
    return null;
  }
}

function routeToStep(route: TaskShopRoute): UserFlowState["stepId"] {
  switch (route) {
    case "/":
      return "catalog";
    case "/cart":
      return "cart";
    case "/checkout":
      return "checkout";
    case "/success":
      return "completed";
  }
}
