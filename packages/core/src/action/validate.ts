import { createHmac, timingSafeEqual } from "node:crypto";

import type { ActionContextToken } from "./types.js";

export const SIGNED_ACTION_CONTEXT_PREFIX = "tfp2";

export function createSignedActionContext(data: ActionContextToken, secret: string): string {
  if (!secret) {
    throw new Error("A non-empty secret is required for action context signing.");
  }

  const serialized = stableSerializeRecord(data);
  const payload = encodeBase64Url(serialized);
  const signature = encodeBase64Url(hmacTag(payload, secret));

  return `${SIGNED_ACTION_CONTEXT_PREFIX}.${payload}.${signature}`;
}

export function verifySignedActionContext(
  signedPayload: string,
  secret: string
): ActionContextToken | null {
  const [prefix, payload, signature] = signedPayload.split(".");

  if (prefix !== SIGNED_ACTION_CONTEXT_PREFIX || !payload || !signature) {
    return null;
  }

  if (!verifySignature(payload, signature, secret)) {
    return null;
  }

  return decodeActionContextToken(signedPayload);
}

export function decodeActionContextToken(signedPayload: string): ActionContextToken | null {
  const [prefix, payload] = signedPayload.split(".");

  if (prefix !== SIGNED_ACTION_CONTEXT_PREFIX || !payload) {
    return null;
  }

  try {
    const decoded = decodeBase64Url(payload).toString("utf8");
    const parsed = parseJsonRecord(decoded);

    return parsed && isActionContextRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function validateActionContext(
  token: string,
  secret: string,
  options?: {
    allowedAction?: string;
    flowId?: string;
    screenId?: string;
  }
): ActionContextToken | null {
  const ctx = verifySignedActionContext(token, secret);

  if (!ctx) {
    return null;
  }

  if (ctx.expiresAt < Date.now() / 1000) {
    return null;
  }

  if (options?.flowId && ctx.flowId !== options.flowId) {
    return null;
  }

  if (options?.screenId && ctx.screenId !== options.screenId) {
    return null;
  }

  if (
    options?.allowedAction &&
    ctx.allowedActions &&
    ctx.allowedActions.length > 0 &&
    !ctx.allowedActions.includes(options.allowedAction)
  ) {
    return null;
  }

  return ctx;
}

export function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function encodeBase64Url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function hmacTag(value: string, secret: string, length = 32): Buffer {
  return createHmac("sha256", secret).update(value).digest().subarray(0, length);
}

function parseJsonRecord(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function verifySignature(value: string, signature: string, secret: string, length = 32): boolean {
  const received = decodeBase64Url(signature);
  const expected = hmacTag(value, secret, length);

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isActionContextRecord(value: Record<string, unknown>): value is ActionContextToken {
  return (
    typeof value.appId === "string" &&
    typeof value.flowId === "string" &&
    typeof value.userId === "string" &&
    typeof value.issuedAt === "number" &&
    typeof value.expiresAt === "number"
  );
}

function stableSerializeRecord(value: Record<string, unknown>): string {
  return JSON.stringify(sortUnknown(value));
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
