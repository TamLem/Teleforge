import { useEffect, useState } from "react";

import { createEventBus, getGlobalEventBus, type CreateEventBusOptions } from "./index.js";

import type { EventBus, EventHandler } from "./types.js";

/**
 * Returns either the shared global Teleforge event bus or a scoped bus created for the current
 * component tree.
 */
export function useEventBus(options?: CreateEventBusOptions): EventBus {
  const [bus] = useState<EventBus>(() => (options ? createEventBus(options) : getGlobalEventBus()));

  return bus;
}

/**
 * Subscribes a React component to a Teleforge event type and automatically removes the listener
 * when the component unmounts.
 */
export function useEvent<T>(type: string, handler: EventHandler<T>, bus?: EventBus): void {
  const resolvedBus = bus ?? useEventBus();

  useEffect(() => resolvedBus.on(type, handler), [handler, resolvedBus, type]);
}

/**
 * Creates a callback that forwards arbitrary payloads to the active event bus so Mini Apps can
 * publish structured messages back to their bot counterpart.
 */
export function useEventPublisher(bus?: EventBus): (payload: unknown) => void {
  const resolvedBus = bus ?? useEventBus();

  return (payload: unknown) => {
    resolvedBus.publishToBot(payload);
  };
}
