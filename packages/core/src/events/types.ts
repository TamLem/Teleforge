import { generateEventId } from "./utils.js";

export interface OrderEventPayload {
  currency: string;
  items: Array<{
    id: string;
    quantity: number;
  }>;
  total: number;
  type: "order";
}

export interface TeleforgeEventMap {
  "app:error": {
    code?: string;
    message: string;
    meta?: Record<string, unknown>;
  };
  "app:ready": {
    ready: boolean;
  };
  "app:route:change": {
    params?: Record<string, string>;
    path: string;
  };
  "commerce:order:completed": OrderEventPayload;
  "commerce:order:created": OrderEventPayload;
  "commerce:payment:initiated": {
    amount?: number;
    currency?: string;
    meta?: Record<string, unknown>;
  };
  "system:capability:change": {
    capability?: string;
    enabled?: boolean;
    meta?: Record<string, unknown>;
  };
  "telegram:event": {
    name?: string;
    payload?: unknown;
  };
  "tf:navigate": {
    params?: Record<string, string>;
    path: string;
  };
  "tf:session.created": {
    session: unknown;
  };
  "tf:theme.changed": {
    theme: unknown;
  };
  "user:action": {
    action: string;
    data?: unknown;
  };
  "user:login": {
    meta?: Record<string, unknown>;
    userId?: string;
  };
  "user:logout": {
    meta?: Record<string, unknown>;
    userId?: string;
  };
}

export interface BotEventSource {
  botId?: string;
  surface: "bot";
}

export interface MiniAppEventSource {
  surface: "miniapp";
  webAppInstanceId?: string;
}

export interface ApiEventSource {
  requestId?: string;
  surface: "api";
}

export interface SystemEventSource {
  sessionId?: string;
  surface: "system";
}

export type TeleforgeEventSource =
  | ApiEventSource
  | BotEventSource
  | MiniAppEventSource
  | SystemEventSource;
export type LegacyTeleforgeEventSource = "api" | "bot" | "miniapp" | "system";
export type EventSourceInput = LegacyTeleforgeEventSource | TeleforgeEventSource;
export type EventType = keyof TeleforgeEventMap & string;
export type EventPayload<TType extends string> = TType extends EventType
  ? TeleforgeEventMap[TType]
  : unknown;

export interface TeleforgeEvent<TType extends string = string, TPayload = EventPayload<TType>> {
  id: string;
  payload: TPayload;
  sessionId?: string;
  source: TeleforgeEventSource;
  timestamp: number;
  traceId?: string;
  type: TType;
}

export interface TeleforgeEventInput<
  TType extends string = string,
  TPayload = EventPayload<TType>
> {
  id?: string;
  payload: TPayload;
  sessionId?: string;
  source: EventSourceInput;
  timestamp?: number;
  traceId?: string;
  type: TType;
}

export interface EmitEventOptions {
  id?: string;
  sessionId?: string;
  source?: EventSourceInput;
  timestamp?: number;
  traceId?: string;
}

export interface EventRequestOptions extends EmitEventOptions {
  timeoutMs?: number;
}

export type EventHandler<TPayload = unknown, TType extends string = string> = (
  event: TeleforgeEvent<TType, TPayload>
) => void | Promise<void>;

export interface TelemetryCollector {
  collect: (event: TeleforgeEvent) => void | Promise<void>;
}

export interface EventBus {
  emit<TType extends EventType>(
    type: TType,
    payload: TeleforgeEventMap[TType],
    options?: EmitEventOptions
  ): TeleforgeEvent<TType>;
  emit<TType extends string, TPayload>(
    event: TeleforgeEventInput<TType, TPayload>
  ): TeleforgeEvent<TType, TPayload>;
  off<TType extends string, TPayload = EventPayload<TType>>(
    type: TType,
    handler: EventHandler<TPayload, TType>
  ): void;
  on<TType extends string, TPayload = EventPayload<TType>>(
    type: TType,
    handler: EventHandler<TPayload, TType>
  ): () => void;
  once<TType extends string, TPayload = EventPayload<TType>>(
    type: TType,
    handler: EventHandler<TPayload, TType>
  ): () => void;
  publishToBot: (payload: unknown) => void;
  request<TReq extends EventType, TRes extends EventType>(
    requestType: TReq,
    payload: TeleforgeEventMap[TReq],
    responseType: TRes,
    timeoutMs?: number,
    options?: EmitEventOptions
  ): Promise<TeleforgeEventMap[TRes]>;
  setTelemetryCollector: (collector: TelemetryCollector | null) => void;
}

export const EventTypes = {
  APP_ERROR: "app:error",
  APP_READY: "app:ready",
  CAPABILITY_CHANGE: "system:capability:change",
  NAVIGATE: "tf:navigate",
  ORDER_COMPLETED: "commerce:order:completed",
  ORDER_CREATED: "commerce:order:created",
  PAYMENT_INITIATED: "commerce:payment:initiated",
  ROUTE_CHANGE: "app:route:change",
  SESSION_CREATED: "tf:session.created",
  TELEGRAM_EVENT: "telegram:event",
  THEME_CHANGED: "tf:theme.changed",
  USER_ACTION: "user:action",
  USER_LOGIN: "user:login",
  USER_LOGOUT: "user:logout"
} as const;

export function createEvent<TType extends string, TPayload = EventPayload<TType>>(
  input: TeleforgeEventInput<TType, TPayload>
): TeleforgeEvent<TType, TPayload> {
  return {
    id: input.id ?? generateEventId(),
    payload: input.payload,
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    source: normalizeEventSource(input.source, input.sessionId),
    timestamp: input.timestamp ?? Date.now(),
    ...(input.traceId ? { traceId: input.traceId } : {}),
    type: input.type
  };
}

export function createOrderEvent(
  order: OrderEventPayload,
  source: EventSourceInput = "miniapp"
): TeleforgeEventInput<typeof EventTypes.ORDER_CREATED, OrderEventPayload> {
  return {
    payload: order,
    source,
    type: EventTypes.ORDER_CREATED
  };
}

export function normalizeEventSource(
  source: EventSourceInput,
  sessionId?: string
): TeleforgeEventSource {
  if (typeof source !== "string") {
    return source.surface === "system" && sessionId && !source.sessionId
      ? {
          ...source,
          sessionId
        }
      : source;
  }

  switch (source) {
    case "api":
      return {
        surface: "api"
      };
    case "bot":
      return {
        surface: "bot"
      };
    case "miniapp":
      return {
        surface: "miniapp"
      };
    case "system":
    default:
      return {
        ...(sessionId ? { sessionId } : {}),
        surface: "system"
      };
  }
}
