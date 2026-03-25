import { BffError } from "../errors/base.js";

import type { BffSessionErrorCode } from "./types.js";

export class BffSessionError extends BffError {
  constructor(
    code: BffSessionErrorCode,
    status: number,
    message?: string,
    meta?: Record<string, unknown>
  ) {
    super(code, {
      message: message ?? code,
      meta,
      statusCode: status
    });
    this.name = "BffSessionError";
  }
}
