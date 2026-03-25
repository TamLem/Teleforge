import { BffError } from "../errors/base.js";

import type { BffContextErrorCode } from "./types.js";

export class BffContextError extends BffError {
  constructor(
    code: BffContextErrorCode,
    status: number,
    message?: string,
    meta?: Record<string, unknown>
  ) {
    super(code, {
      message: message ?? code,
      meta,
      statusCode: status
    });
    this.name = "BffContextError";
  }
}
