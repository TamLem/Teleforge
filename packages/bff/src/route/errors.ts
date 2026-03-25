import type { BffRouteErrorCode } from "./types.js";

export class BffRouteError extends Error {
  constructor(
    public readonly code: BffRouteErrorCode,
    public readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "BffRouteError";
  }
}
