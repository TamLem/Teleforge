import type { BffIdentityErrorCode } from "./types.js";

export class BffIdentityError extends Error {
  constructor(
    public readonly code: BffIdentityErrorCode,
    public readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "BffIdentityError";
  }
}
