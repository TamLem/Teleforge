import { createHmac, timingSafeEqual } from "node:crypto";

export const CALLBACK_PREFIX = "tfc1";
export const SIGNED_PAYLOAD_PREFIX = "tfp1";

export function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function encodeBase64Url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

export function ensureSecret(secret: string): void {
  if (!secret) {
    throw new Error("A non-empty coordination secret is required.");
  }
}

export function hmacTag(value: string, secret: string, length = 32): Buffer {
  ensureSecret(secret);

  return createHmac("sha256", secret).update(value).digest().subarray(0, length);
}

export function parseJsonRecord(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function stableSerializeRecord(value: Record<string, unknown>): string {
  return JSON.stringify(sortUnknown(value));
}

export function verifySignature(
  value: string,
  signature: string,
  secret: string,
  length = 32
): boolean {
  const received = decodeBase64Url(signature);
  const expected = hmacTag(value, secret, length);

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortUnknown(entry));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortUnknown(value[key])])
  );
}
