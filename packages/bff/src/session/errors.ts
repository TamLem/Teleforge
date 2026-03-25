import type { BffSessionErrorCode } from "./types.js";

export class BffSessionError extends Error {
  constructor(
    public readonly code: BffSessionErrorCode,
    public readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "BffSessionError";
  }
}
