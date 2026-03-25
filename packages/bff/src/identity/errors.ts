import { BffError } from "../errors/base.js";

import type { BffIdentityErrorCode } from "./types.js";

export class BffIdentityError extends BffError {
  constructor(
    code: BffIdentityErrorCode,
    status: number,
    message?: string,
    meta?: Record<string, unknown>
  ) {
    super(code, {
      message: message ?? code,
      meta,
      statusCode: status
    });
    this.name = "BffIdentityError";
  }
}
