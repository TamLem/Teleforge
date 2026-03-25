import { BffSessionError } from "./errors.js";

import type { SessionClaims } from "./types.js";

const ACCESS_TOKEN_TTL_SECONDS = 30 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const textEncoder = new TextEncoder();

export async function createAccessToken(
  claims: Omit<SessionClaims, "exp" | "iat" | "type">,
  secret: string,
  ttlSeconds = ACCESS_TOKEN_TTL_SECONDS,
  nowSeconds = getCurrentTimestampSeconds()
): Promise<{ claims: SessionClaims; token: string }> {
  const sessionClaims: SessionClaims = {
    ...claims,
    exp: nowSeconds + ttlSeconds,
    iat: nowSeconds,
    type: "access"
  };

  return {
    claims: sessionClaims,
    token: await signJwt(sessionClaims, secret)
  };
}

export async function createRefreshToken(): Promise<string> {
  return encodeBase64Url(getRandomBytes(32));
}

export async function hashRefreshToken(token: string): Promise<string> {
  const subtle = getSubtleCrypto();
  const digest = await subtle.digest("SHA-256", textEncoder.encode(token));

  return encodeBase64Url(new Uint8Array(digest));
}

export function getAccessTokenTtlSeconds(ttlSeconds?: number): number {
  return ttlSeconds ?? ACCESS_TOKEN_TTL_SECONDS;
}

export function getRefreshTokenTtlSeconds(ttlSeconds?: number): number {
  return ttlSeconds ?? REFRESH_TOKEN_TTL_SECONDS;
}

export async function verifyAccessToken(
  token: string,
  secret: string,
  nowSeconds = getCurrentTimestampSeconds()
): Promise<SessionClaims> {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new BffSessionError("TOKEN_INVALID", 401, "Malformed session access token.");
  }

  const payload = parseJsonSegment<Partial<SessionClaims>>(encodedPayload);

  if (payload.type !== "access") {
    throw new BffSessionError("TOKEN_INVALID", 401, "Unsupported session token type.");
  }

  const isValid = await verifyJwtSignature(
    `${encodedHeader}.${encodedPayload}`,
    encodedSignature,
    secret
  );

  if (!isValid) {
    throw new BffSessionError("TOKEN_INVALID", 401, "Session access token signature is invalid.");
  }

  if (
    typeof payload.sub !== "string" ||
    typeof payload.sid !== "string" ||
    typeof payload.tid !== "number" ||
    typeof payload.iat !== "number" ||
    typeof payload.exp !== "number"
  ) {
    throw new BffSessionError("TOKEN_INVALID", 401, "Session access token payload is invalid.");
  }

  if (payload.exp <= nowSeconds) {
    throw new BffSessionError("TOKEN_EXPIRED", 401, "Session access token has expired.");
  }

  return payload as SessionClaims;
}

export async function verifyRefreshToken(
  refreshToken: string,
  expectedHash: string
): Promise<void> {
  const actualHash = await hashRefreshToken(refreshToken);

  if (!timingSafeEqual(actualHash, expectedHash)) {
    throw new BffSessionError("REFRESH_TOKEN_INVALID", 401, "Refresh token is invalid.");
  }
}

async function signJwt(payload: SessionClaims, secret: string): Promise<string> {
  const encodedHeader = encodeJsonSegment({
    alg: "HS256",
    typ: "JWT"
  });
  const encodedPayload = encodeJsonSegment(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const subtle = getSubtleCrypto();
  const key = await subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    {
      hash: "SHA-256",
      name: "HMAC"
    },
    false,
    ["sign"]
  );
  const signature = await subtle.sign("HMAC", key, textEncoder.encode(signingInput));

  return `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;
}

async function verifyJwtSignature(signingInput: string, encodedSignature: string, secret: string) {
  const subtle = getSubtleCrypto();
  const key = await subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    {
      hash: "SHA-256",
      name: "HMAC"
    },
    false,
    ["verify"]
  );

  return await subtle.verify(
    "HMAC",
    key,
    toArrayBuffer(decodeBase64Url(encodedSignature)),
    toArrayBuffer(textEncoder.encode(signingInput))
  );
}

function encodeJsonSegment(value: unknown) {
  return encodeBase64Url(textEncoder.encode(JSON.stringify(value)));
}

function parseJsonSegment<T>(value: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
  } catch {
    throw new BffSessionError("TOKEN_INVALID", 401, "Failed to parse session token payload.");
  }
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary =
    typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const base64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(bytes).toString("base64");

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function getCurrentTimestampSeconds() {
  return Math.floor(Date.now() / 1000);
}

function getRandomBytes(length: number) {
  const crypto = globalThis.crypto;

  if (!crypto?.getRandomValues) {
    throw new Error("Session token generation requires WebCrypto getRandomValues support.");
  }

  return crypto.getRandomValues(new Uint8Array(length));
}

function getSubtleCrypto() {
  const subtle = globalThis.crypto?.subtle;

  if (!subtle) {
    throw new Error("Session token validation requires WebCrypto support.");
  }

  return subtle;
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copied = new Uint8Array(bytes.byteLength);

  copied.set(bytes);

  return copied.buffer;
}
