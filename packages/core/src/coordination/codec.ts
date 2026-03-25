import { createHmac, timingSafeEqual } from "node:crypto";

import type { FlowContext } from "./types.js";

export const SIGNED_FLOW_CONTEXT_PREFIX = "tfp1";

export function createSignedFlowContext(data: FlowContext, secret: string): string {
  const serialized = stableSerializeRecord(data);
  const payload = encodeBase64Url(serialized);
  const signature = encodeBase64Url(hmacTag(payload, secret));

  return `${SIGNED_FLOW_CONTEXT_PREFIX}.${payload}.${signature}`;
}

export function verifySignedFlowContext(signedPayload: string, secret: string): FlowContext | null {
  const [prefix, payload, signature] = signedPayload.split(".");

  if (prefix !== SIGNED_FLOW_CONTEXT_PREFIX || !payload || !signature) {
    return null;
  }

  if (!verifySignature(payload, signature, secret)) {
    return null;
  }

  return decodeSignedFlowContext(signedPayload);
}

export function decodeSignedFlowContext(signedPayload: string): FlowContext | null {
  const [prefix, payload] = signedPayload.split(".");

  if (prefix !== SIGNED_FLOW_CONTEXT_PREFIX || !payload) {
    return null;
  }

  try {
    const decoded = decodeBase64Url(payload).toString("utf8");
    const parsed = parseJsonRecord(decoded);

    return parsed && isFlowContextRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function inferStateKeyFromFlowContext(flowContext: string | null): string | null {
  const parsed = flowContext ? decodeSignedFlowContext(flowContext) : null;
  const stateKey = parsed?.payload.stateKey;

  return typeof stateKey === "string" ? stateKey : null;
}

export function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function encodeBase64Url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function ensureSecret(secret: string): void {
  if (!secret) {
    throw new Error("A non-empty coordination secret is required.");
  }
}

function hmacTag(value: string, secret: string, length = 32): Buffer {
  ensureSecret(secret);

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

function stableSerializeRecord(value: Record<string, unknown>): string {
  return JSON.stringify(sortUnknown(value));
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

function isFlowContextRecord(value: Record<string, unknown>): value is FlowContext {
  return typeof value.flowId === "string" && isRecord(value.payload);
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
