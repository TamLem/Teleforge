import { TeleforgeEventBus, type TeleforgeEventBusOptions } from "./bus.js";

import type { EventBus } from "./types.js";

export type CreateEventBusOptions = TeleforgeEventBusOptions;

let globalBus: EventBus | null = null;

export function createEventBus(options: CreateEventBusOptions = {}): EventBus {
  return new TeleforgeEventBus(options);
}

export function getGlobalEventBus(): EventBus {
  globalBus ??= createEventBus();
  return globalBus;
}

export function resetGlobalEventBus(): void {
  globalBus = null;
}
