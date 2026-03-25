import { TeleforgeEventError, EventErrorCodes } from "./errors.js";
import { createEvent } from "./types.js";
import { generateEventId, getTelegramPublisher } from "./utils.js";

import type {
  EmitEventOptions,
  EventBus,
  EventHandler,
  EventType,
  TeleforgeEvent,
  TeleforgeEventInput,
  TeleforgeEventMap,
  TeleforgeEventSource,
  TelemetryCollector
} from "./types.js";

interface PendingRequest {
  reject: (reason?: unknown) => void;
  resolve: (payload: unknown) => void;
  timeoutId: ReturnType<typeof setTimeout>;
  traceId: string;
}

export interface TeleforgeEventBusOptions {
  sessionId?: string;
  source?: TeleforgeEventSource;
  telemetry?: TelemetryCollector;
}

export class TeleforgeEventBus implements EventBus {
  private handlers = new Map<string, Set<EventHandler<unknown>>>();
  private pendingRequests = new Map<string, Set<PendingRequest>>();

  private readonly defaultSource: TeleforgeEventSource;
  private sessionId: string;
  private telemetry: TelemetryCollector | null;

  constructor(options: TeleforgeEventBusOptions = {}) {
    this.sessionId = options.sessionId ?? generateEventId();
    this.defaultSource =
      options.source ??
      ({
        ...(options.sessionId ? { sessionId: options.sessionId } : {}),
        surface: "system"
      } satisfies TeleforgeEventSource);
    this.telemetry = options.telemetry ?? null;
  }

  emit<TType extends EventType>(
    type: TType,
    payload: TeleforgeEventMap[TType],
    options?: EmitEventOptions
  ): TeleforgeEvent<TType>;
  emit<TType extends string, TPayload>(
    event: TeleforgeEventInput<TType, TPayload>
  ): TeleforgeEvent<TType, TPayload>;
  emit<TType extends string, TPayload>(
    typeOrEvent: TType | TeleforgeEventInput<TType, TPayload>,
    payload?: TPayload,
    options: EmitEventOptions = {}
  ) {
    const fullEvent = this.normalizeEvent(
      typeof typeOrEvent === "string"
        ? {
            ...options,
            payload: payload as TPayload,
            source: options.source ?? this.defaultSource,
            type: typeOrEvent
          }
        : typeOrEvent
    );

    this.resolvePendingRequests(fullEvent);
    this.dispatchTelemetry(fullEvent);
    this.dispatchHandlers(fullEvent.type, fullEvent);
    this.dispatchHandlers("*", fullEvent);

    return fullEvent;
  }

  off<TType extends string, TPayload = unknown>(
    type: TType,
    handler: EventHandler<TPayload, TType>
  ): void {
    const handlers = this.handlers.get(type);
    if (!handlers) {
      return;
    }

    handlers.delete(handler as EventHandler<unknown>);
    if (handlers.size === 0) {
      this.handlers.delete(type);
    }
  }

  on<TType extends string, TPayload = unknown>(
    type: TType,
    handler: EventHandler<TPayload, TType>
  ): () => void {
    const handlers = this.handlers.get(type) ?? new Set<EventHandler<unknown>>();
    handlers.add(handler as EventHandler<unknown>);
    this.handlers.set(type, handlers);

    return () => this.off(type, handler);
  }

  once<TType extends string, TPayload = unknown>(
    type: TType,
    handler: EventHandler<TPayload, TType>
  ): () => void {
    const onceHandler: EventHandler<TPayload, TType> = async (event) => {
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

  request<TReq extends EventType, TRes extends EventType>(
    requestType: TReq,
    payload: TeleforgeEventMap[TReq],
    responseType: TRes,
    timeoutMs = 5000,
    options: EmitEventOptions = {}
  ): Promise<TeleforgeEventMap[TRes]> {
    const traceId = options.traceId ?? generateEventId();

    return new Promise((resolve, reject) => {
      const pendingRequest: PendingRequest = {
        reject,
        resolve: resolve as (payload: unknown) => void,
        timeoutId: setTimeout(() => {
          this.removePendingRequest(responseType, pendingRequest);
          reject(
            new TeleforgeEventError(EventErrorCodes.EVENT_TIMEOUT, {
              message: `Timed out waiting for ${responseType}.`,
              meta: {
                requestType,
                responseType,
                timeoutMs,
                traceId
              }
            })
          );
        }, timeoutMs),
        traceId
      };

      const pending = this.pendingRequests.get(responseType) ?? new Set<PendingRequest>();
      pending.add(pendingRequest);
      this.pendingRequests.set(responseType, pending);

      this.emit(requestType, payload, {
        ...options,
        traceId
      });
    });
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

  private normalizeEvent<TType extends string, TPayload>(
    event: TeleforgeEventInput<TType, TPayload>
  ): TeleforgeEvent<TType, TPayload> {
    return createEvent({
      ...event,
      sessionId: event.sessionId ?? this.sessionId,
      source: event.source ?? this.defaultSource
    });
  }

  private removePendingRequest(type: string, pendingRequest: PendingRequest) {
    const pending = this.pendingRequests.get(type);
    if (!pending) {
      return;
    }

    pending.delete(pendingRequest);
    if (pending.size === 0) {
      this.pendingRequests.delete(type);
    }
  }

  private resolvePendingRequests(event: TeleforgeEvent) {
    if (!event.traceId) {
      return;
    }

    const pending = this.pendingRequests.get(event.type);
    if (!pending) {
      return;
    }

    for (const request of [...pending]) {
      if (request.traceId !== event.traceId) {
        continue;
      }

      clearTimeout(request.timeoutId);
      pending.delete(request);
      request.resolve(event.payload);
    }

    if (pending.size === 0) {
      this.pendingRequests.delete(event.type);
    }
  }
}
