import { BffError } from "./base.js";
import { BffErrorCodes } from "./codes.js";

import type { BffErrorCode } from "./codes.js";

export interface FieldError {
  code: string;
  message: string;
  path: string;
}

export class BffValidationError extends BffError {
  constructor(
    code: BffErrorCode = BffErrorCodes.MALFORMED_BODY,
    message = "The request payload is invalid.",
    fields: readonly FieldError[],
    meta?: Record<string, unknown>
  ) {
    super(code, {
      fields,
      message,
      meta
    });
    this.name = "BffValidationError";
  }
}
