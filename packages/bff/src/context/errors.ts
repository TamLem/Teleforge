import type { BffContextErrorCode } from "./types.js";

export class BffContextError extends Error {
  constructor(
    public readonly code: BffContextErrorCode,
    public readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "BffContextError";
  }
}
