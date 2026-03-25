export type TeleforgeEventSource = "miniapp" | "bot" | "api" | "system";

export interface OrderEventPayload {
  currency: string;
  items: Array<{
    id: string;
    quantity: number;
  }>;
  total: number;
  type: "order";
}

export interface TeleforgeEvent<T = unknown> {
  id: string;
  payload: T;
  sessionId?: string;
  source: TeleforgeEventSource;
  timestamp: number;
  type: string;
}

export interface TeleforgeEventInput<T = unknown> {
  id?: string;
  payload: T;
  sessionId?: string;
  source: TeleforgeEventSource;
  timestamp?: number;
  type: string;
}

export type EventHandler<T = unknown> = (event: TeleforgeEvent<T>) => void | Promise<void>;

export interface TelemetryCollector {
  collect: (event: TeleforgeEvent) => void | Promise<void>;
}

export interface EventBus {
  emit: <T>(event: TeleforgeEventInput<T>) => void;
  off: <T>(type: string, handler: EventHandler<T>) => void;
  on: <T>(type: string, handler: EventHandler<T>) => () => void;
  once: <T>(type: string, handler: EventHandler<T>) => () => void;
  publishToBot: (payload: unknown) => void;
  setTelemetryCollector: (collector: TelemetryCollector | null) => void;
}

export const EventTypes = {
  APP_ERROR: "app:error",
  APP_READY: "app:ready",
  CAPABILITY_CHANGE: "system:capability:change",
  ORDER_COMPLETED: "commerce:order:completed",
  ORDER_CREATED: "commerce:order:created",
  PAYMENT_INITIATED: "commerce:payment:initiated",
  ROUTE_CHANGE: "app:route:change",
  TELEGRAM_EVENT: "telegram:event",
  USER_ACTION: "user:action",
  USER_LOGIN: "user:login",
  USER_LOGOUT: "user:logout"
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

export function createEvent<T>(input: TeleforgeEventInput<T>): TeleforgeEvent<T> {
  return {
    id: input.id ?? "",
    payload: input.payload,
    sessionId: input.sessionId,
    source: input.source,
    timestamp: input.timestamp ?? 0,
    type: input.type
  };
}

export function createOrderEvent(
  order: OrderEventPayload,
  source: TeleforgeEventSource = "miniapp"
): TeleforgeEventInput<OrderEventPayload> {
  return {
    payload: order,
    source,
    type: EventTypes.ORDER_CREATED
  };
}
