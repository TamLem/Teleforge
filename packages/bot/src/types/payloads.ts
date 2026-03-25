export interface OrderPayload {
  currency: string;
  items: Array<{
    id: string;
    quantity: number;
  }>;
  total: number;
  type: "order";
}

export interface FormPayload {
  fields: Record<string, string>;
  type: "form";
}

export interface EventPayload {
  data: unknown;
  event: string;
  type: "event";
}

export function isOrderPayload(payload: unknown): payload is OrderPayload {
  return (
    isRecord(payload) &&
    payload.type === "order" &&
    typeof payload.total === "number" &&
    typeof payload.currency === "string" &&
    Array.isArray(payload.items)
  );
}

export function isFormPayload(payload: unknown): payload is FormPayload {
  return isRecord(payload) && payload.type === "form" && isRecord(payload.fields);
}

export function isEventPayload(payload: unknown): payload is EventPayload {
  return isRecord(payload) && payload.type === "event" && typeof payload.event === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
