import { BffErrorCodes } from "./codes.js";
import { getStatusCodeForBffError } from "./http.js";

import type { BffErrorCode } from "./codes.js";
import type { FieldError } from "./validation.js";

export interface ErrorResponse {
  error: {
    code: string;
    fields?: readonly FieldError[];
    message: string;
    meta?: Record<string, unknown>;
    requestId: string;
    timestamp: string;
  };
}

export interface BffErrorOptions {
  cause?: unknown;
  fields?: readonly FieldError[];
  message?: string;
  meta?: Record<string, unknown>;
  statusCode?: number;
}

export class BffError extends Error {
  override readonly cause?: unknown;
  readonly fields?: readonly FieldError[];
  readonly meta?: Record<string, unknown>;
  readonly statusCode: number;

  constructor(
    public readonly code: BffErrorCode,
    options: BffErrorOptions = {}
  ) {
    super(options.message ?? code);
    this.name = "BffError";
    this.cause = options.cause;
    this.fields = options.fields;
    this.meta = options.meta;
    this.statusCode = options.statusCode ?? getStatusCodeForBffError(code);
  }

  get status() {
    return this.statusCode;
  }

  toJSON(requestId: string, timestamp = new Date().toISOString()): ErrorResponse {
    return {
      error: {
        code: this.code,
        ...(this.fields && this.fields.length > 0 ? { fields: this.fields } : {}),
        message: this.message,
        ...(this.meta ? { meta: this.meta } : {}),
        requestId,
        timestamp
      }
    };
  }

  static fromCode(code: BffErrorCode, options: BffErrorOptions = {}) {
    return new BffError(code, options);
  }
}

export function ensureBffError(error: unknown): BffError {
  if (error instanceof BffError) {
    return error;
  }

  if (error instanceof Error) {
    return BffError.fromCode(BffErrorCodes.INTERNAL_ERROR, {
      cause: error,
      message: "An internal BFF error occurred."
    });
  }

  return BffError.fromCode(BffErrorCodes.INTERNAL_ERROR, {
    cause: error,
    message: "An internal BFF error occurred."
  });
}

export function serializeErrorResponse(error: unknown, requestId: string) {
  const bffError = ensureBffError(error);

  return {
    body: bffError.toJSON(requestId),
    error: bffError,
    status: bffError.statusCode
  };
}
