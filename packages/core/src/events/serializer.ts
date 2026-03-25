import { EventErrorCodes, TeleforgeEventError } from "./errors.js";
import { normalizeEventSource } from "./types.js";

import type { TeleforgeEvent } from "./types.js";

export const eventSerializer = {
  deserialize<TType extends string>(data: string): TeleforgeEvent<TType> {
    let parsed: unknown;

    try {
      parsed = JSON.parse(data);
    } catch (error) {
      throw new TeleforgeEventError(EventErrorCodes.EVENT_SERIALIZATION_FAILED, {
        cause: error,
        message: "Failed to deserialize Teleforge event payload."
      });
    }

    return validateSerializedEvent(parsed);
  },
  serialize<TType extends string>(event: TeleforgeEvent<TType>): string {
    try {
      return JSON.stringify(event);
    } catch (error) {
      throw new TeleforgeEventError(EventErrorCodes.EVENT_SERIALIZATION_FAILED, {
        cause: error,
        message: "Failed to serialize Teleforge event payload."
      });
    }
  }
};

function validateSerializedEvent<TType extends string>(value: unknown): TeleforgeEvent<TType> {
  if (!value || typeof value !== "object") {
    throw new TeleforgeEventError(EventErrorCodes.EVENT_SERIALIZATION_FAILED, {
      message: "Serialized Teleforge events must decode to an object."
    });
  }

  const record = value as Record<string, unknown>;

  if (typeof record.type !== "string" || record.type.trim().length === 0) {
    throw new TeleforgeEventError(EventErrorCodes.EVENT_INVALID_TYPE, {
      message: "Serialized Teleforge events must include a non-empty string type."
    });
  }

  if (typeof record.id !== "string" || record.id.trim().length === 0) {
    throw new TeleforgeEventError(EventErrorCodes.EVENT_SERIALIZATION_FAILED, {
      message: "Serialized Teleforge events must include a non-empty string id."
    });
  }

  if (typeof record.timestamp !== "number") {
    throw new TeleforgeEventError(EventErrorCodes.EVENT_SERIALIZATION_FAILED, {
      message: "Serialized Teleforge events must include a numeric timestamp."
    });
  }

  if (!("payload" in record)) {
    throw new TeleforgeEventError(EventErrorCodes.EVENT_SERIALIZATION_FAILED, {
      message: "Serialized Teleforge events must include a payload."
    });
  }

  return {
    id: record.id,
    payload: record.payload as TeleforgeEvent<TType>["payload"],
    ...(typeof record.sessionId === "string" ? { sessionId: record.sessionId } : {}),
    source: normalizeEventSource(
      (record.source as Parameters<typeof normalizeEventSource>[0]) ?? "system",
      typeof record.sessionId === "string" ? record.sessionId : undefined
    ),
    timestamp: record.timestamp,
    ...(typeof record.traceId === "string" ? { traceId: record.traceId } : {}),
    type: record.type as TType
  };
}
