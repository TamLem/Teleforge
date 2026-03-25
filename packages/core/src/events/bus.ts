import { generateEventId, getTelegramPublisher } from "./utils.js";

import type {
  EventBus,
  EventHandler,
  TeleforgeEvent,
  TeleforgeEventInput,
  TelemetryCollector
} from "./types.js";

export interface TeleforgeEventBusOptions {
  sessionId?: string;
  telemetry?: TelemetryCollector;
}

export class TeleforgeEventBus implements EventBus {
  private handlers = new Map<string, Set<EventHandler<unknown>>>();

  private sessionId: string;

  private telemetry: TelemetryCollector | null;

  constructor(options: TeleforgeEventBusOptions = {}) {
    this.sessionId = options.sessionId ?? generateEventId();
    this.telemetry = options.telemetry ?? null;
  }

  emit<T>(event: TeleforgeEventInput<T>): void {
    const fullEvent = this.normalizeEvent(event);

    this.dispatchTelemetry(fullEvent);
    this.dispatchHandlers(fullEvent.type, fullEvent);
    this.dispatchHandlers("*", fullEvent);
  }

  off<T>(type: string, handler: EventHandler<T>): void {
    const handlers = this.handlers.get(type);
    if (!handlers) {
      return;
    }

    handlers.delete(handler as EventHandler<unknown>);
    if (handlers.size === 0) {
      this.handlers.delete(type);
    }
  }

  on<T>(type: string, handler: EventHandler<T>): () => void {
    const handlers = this.handlers.get(type) ?? new Set<EventHandler<unknown>>();
    handlers.add(handler as EventHandler<unknown>);
    this.handlers.set(type, handlers);

    return () => this.off(type, handler);
  }

  once<T>(type: string, handler: EventHandler<T>): () => void {
    const onceHandler: EventHandler<T> = async (event) => {
      this.off(type, onceHandler);
      await handler(event);
    };

    return this.on(type, onceHandler);
  }

  publishToBot(payload: unknown): void {
    const publisher = getTelegramPublisher();
    if (!publisher) {
      throw new Error("publishToBot is only available when Telegram WebApp.sendData is present.");
    }

    publisher.sendData(JSON.stringify(payload));
  }

  setTelemetryCollector(collector: TelemetryCollector | null): void {
    this.telemetry = collector;
  }

  private dispatchHandlers(type: string, event: TeleforgeEvent): void {
    const handlers = this.handlers.get(type);
    if (!handlers) {
      return;
    }

    for (const handler of handlers) {
      try {
        const result = handler(event);
        if (result && typeof (result as Promise<void>).then === "function") {
          void (result as Promise<void>).catch(() => {});
        }
      } catch {
        // Handler failures are isolated so one listener cannot crash the bus.
      }
    }
  }

  private dispatchTelemetry(event: TeleforgeEvent): void {
    if (!this.telemetry) {
      return;
    }

    try {
      const result = this.telemetry.collect(event);
      if (result && typeof (result as Promise<void>).then === "function") {
        void (result as Promise<void>).catch(() => {});
      }
    } catch {
      // Telemetry must never break event delivery.
    }
  }

  private normalizeEvent<T>(event: TeleforgeEventInput<T>): TeleforgeEvent<T> {
    return {
      id: event.id ?? generateEventId(),
      payload: event.payload,
      sessionId: event.sessionId ?? this.sessionId,
      source: event.source,
      timestamp: event.timestamp ?? Date.now(),
      type: event.type
    };
  }
}
