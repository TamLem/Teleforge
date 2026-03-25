export const EventErrorCodes = {
  EVENT_INVALID_TYPE: "EVENT_INVALID_TYPE",
  EVENT_SERIALIZATION_FAILED: "EVENT_SERIALIZATION_FAILED",
  EVENT_TIMEOUT: "EVENT_TIMEOUT"
} as const;

export type EventErrorCode = (typeof EventErrorCodes)[keyof typeof EventErrorCodes];

export interface TeleforgeEventErrorOptions {
  cause?: unknown;
  message?: string;
  meta?: Record<string, unknown>;
}

export class TeleforgeEventError extends Error {
  override readonly cause?: unknown;
  readonly meta?: Record<string, unknown>;

  constructor(
    public readonly code: EventErrorCode,
    options: TeleforgeEventErrorOptions = {}
  ) {
    super(options.message ?? code);
    this.name = "TeleforgeEventError";
    this.cause = options.cause;
    this.meta = options.meta;
  }
}
