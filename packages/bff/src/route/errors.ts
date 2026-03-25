import { BffError } from "../errors/base.js";

import type { BffRouteErrorCode } from "./types.js";

export class BffRouteError extends BffError {
  constructor(
    code: BffRouteErrorCode,
    status: number,
    message?: string,
    meta?: Record<string, unknown>
  ) {
    super(code, {
      message: message ?? code,
      meta,
      statusCode: status
    });
    this.name = "BffRouteError";
  }
}
