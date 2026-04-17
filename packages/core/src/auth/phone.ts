import { normalizePhoneNumber } from "../utils/phone.js";

const PHONE_AUTH_TOKEN_PREFIX = "tfpat1";
const DEFAULT_PHONE_AUTH_TOKEN_TTL = 5 * 60 * 1000;
const PHONE_AUTH_SIGNATURE_BYTES = 32;

export interface PhoneAuthTokenPayload {
  expiresAt: number;
  issuedAt: number;
  phoneNumber: string;
  telegramUserId: number;
}

export interface CreateSignedPhoneAuthTokenOptions {
  expiresAt?: number;
  issuedAt?: number;
  ttlMs?: number;
}

export interface VerifySignedPhoneAuthTokenOptions {
  now?: number;
}

export async function createSignedPhoneAuthToken(
  payload: Omit<PhoneAuthTokenPayload, "expiresAt" | "issuedAt" | "phoneNumber"> & {
    expiresAt?: number;
    issuedAt?: number;
    phoneNumber: string;
  },
  secret: string,
  options: CreateSignedPhoneAuthTokenOptions = {}
): Promise<string> {
  const phoneNumber = normalizePhoneNumber(payload.phoneNumber);
  if (!phoneNumber) {
    throw new Error("Phone auth tokens require a normalized phone number.");
  }

  const issuedAt = options.issuedAt ?? payload.issuedAt ?? Date.now();
  const ttlMs = options.ttlMs ?? DEFAULT_PHONE_AUTH_TOKEN_TTL;
  const expiresAt = options.expiresAt ?? payload.expiresAt ?? issuedAt + ttlMs;

  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt) {
    throw new Error("Phone auth token timestamps are invalid.");
  }

  const normalizedPayload: PhoneAuthTokenPayload = {
    expiresAt,
    issuedAt,
    phoneNumber,
    telegramUserId: payload.telegramUserId
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(normalizedPayload));
  const encodedSignature = await signValue(encodedPayload, secret);

  return `${PHONE_AUTH_TOKEN_PREFIX}.${encodedPayload}.${encodedSignature}`;
}

export async function verifySignedPhoneAuthToken(
  token: string,
  secret: string,
  options: VerifySignedPhoneAuthTokenOptions = {}
): Promise<PhoneAuthTokenPayload | null> {
  const [prefix, encodedPayload, signature] = token.split(".");

  if (
    prefix !== PHONE_AUTH_TOKEN_PREFIX ||
    typeof encodedPayload !== "string" ||
    encodedPayload.length === 0 ||
    typeof signature !== "string" ||
    signature.length === 0
  ) {
    return null;
  }

  const isValidSignature = await verifyValue(encodedPayload, signature, secret);
  if (!isValidSignature) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(decodeBase64Url(encodedPayload));
  } catch {
    return null;
  }

  if (!isPhoneAuthTokenPayload(parsed)) {
    return null;
  }

  if ((options.now ?? Date.now()) > parsed.expiresAt) {
    return null;
  }

  return parsed;
}

function isPhoneAuthTokenPayload(value: unknown): value is PhoneAuthTokenPayload {
  if (!isRecord(value)) {
    return false;
  }

  const expiresAt = value.expiresAt;
  const issuedAt = value.issuedAt;
  const phoneNumber = value.phoneNumber;
  const telegramUserId = value.telegramUserId;

  return (
    typeof expiresAt === "number" &&
    typeof issuedAt === "number" &&
    typeof phoneNumber === "string" &&
    normalizePhoneNumber(phoneNumber) === phoneNumber &&
    typeof telegramUserId === "number" &&
    Number.isInteger(telegramUserId) &&
    telegramUserId > 0 &&
    expiresAt > issuedAt
  );
}

async function signValue(value: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return encodeBase64Url(Buffer.from(signature).subarray(0, PHONE_AUTH_SIGNATURE_BYTES));
}

async function verifyValue(value: string, signature: string, secret: string): Promise<boolean> {
  const decodedSignature = decodeBase64UrlToBuffer(signature);

  if (!decodedSignature || decodedSignature.length !== PHONE_AUTH_SIGNATURE_BYTES) {
    return false;
  }

  const expected = decodeBase64UrlToBuffer(await signValue(value, secret));
  if (!expected || expected.length !== decodedSignature.length) {
    return false;
  }

  return timingSafeEqual(decodedSignature, expected);
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  if (typeof secret !== "string" || secret.length === 0) {
    throw new Error("A non-empty phone auth secret is required.");
  }

  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto is required for phone auth tokens.");
  }

  return await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      hash: "SHA-256",
      name: "HMAC"
    },
    false,
    ["sign"]
  );
}

function encodeBase64Url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function decodeBase64UrlToBuffer(value: string): Buffer | null {
  try {
    return Buffer.from(value, "base64url");
  } catch {
    return null;
  }
}

function timingSafeEqual(left: Buffer, right: Buffer): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index] ^ right[index];
  }

  return mismatch === 0;
}

function isRecord(value: unknown): value is Record<string, number | string> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const encoder = new TextEncoder();
