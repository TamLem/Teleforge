import { parseInitData } from "../launch/initData.js";

import { buildThirdPartyDataCheckString, normalizeMaxAge, parseAuthDate } from "./utils.js";

import type { ValidateInitDataResult, Ed25519ValidationOptions } from "./types.js";

const HEX_PATTERN = /^[0-9a-f]+$/i;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Validates Telegram Mini App `initData` using Telegram's Ed25519 third-party validation flow.
 *
 * @param initData Raw `initData` querystring received from the Telegram WebApp bridge.
 * @param publicKey Telegram public key as a hex string or byte array.
 * @param options Validation options including the required bot id and optional max-age controls.
 *
 * @example
 * ```ts
 * const result = await validateInitDataEd25519(initData, publicKey, { botId: 123456789 });
 * if (result.valid) {
 *   console.log(result.data.user?.username);
 * }
 * ```
 */
export async function validateInitDataEd25519(
  initData: string,
  publicKey: string | Uint8Array,
  options: Ed25519ValidationOptions
): Promise<ValidateInitDataResult> {
  try {
    const botId = normalizeBotId(options.botId);
    const publicKeyBytes = parsePublicKey(publicKey);
    const params = new URLSearchParams(initData);
    const receivedSignature = params.get("signature");

    if (!receivedSignature) {
      return failure("Missing signature field.");
    }

    const signatureBytes = parseBase64UrlBytes(receivedSignature);
    if (signatureBytes === null) {
      return failure("Invalid signature encoding.");
    }

    const authDate = parseAuthDate(params.get("auth_date"));
    if (authDate === null) {
      return failure("Invalid auth_date field.");
    }

    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
      return failure("Ed25519 verification requires WebCrypto support.");
    }

    const dataCheckString = buildThirdPartyDataCheckString(params, botId);
    const messageBytes = new TextEncoder().encode(dataCheckString);
    const cryptoKey = await subtle.importKey(
      "raw",
      toArrayBuffer(publicKeyBytes),
      "Ed25519",
      false,
      ["verify"]
    );
    const isValid = await subtle.verify(
      "Ed25519",
      cryptoKey,
      toArrayBuffer(signatureBytes),
      toArrayBuffer(messageBytes)
    );

    if (!isValid) {
      return failure("Invalid signature.");
    }

    const maxAge = normalizeMaxAge(options.maxAge);
    const now = Math.floor(Date.now() / 1000);

    if (now - authDate > maxAge) {
      return {
        error: "initData expired.",
        expired: true,
        valid: false
      };
    }

    const parsed = parseInitData(initData);
    if (!parsed.success) {
      return failure(parsed.error);
    }

    return {
      data: parsed.data,
      valid: true
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ed25519 validation failed.";

    if (options.throwOnError) {
      throw error;
    }

    return failure(message);
  }
}

function failure(error: string): ValidateInitDataResult {
  return {
    error,
    valid: false
  };
}

function normalizeBotId(botId: number): number {
  if (!Number.isInteger(botId) || botId <= 0) {
    throw new Error("Bot ID is required.");
  }

  return botId;
}

function parsePublicKey(value: string | Uint8Array): Uint8Array {
  if (value instanceof Uint8Array) {
    if (value.length !== 32) {
      throw new Error("Invalid public key length.");
    }

    return value;
  }

  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  if (normalized.length !== 64 || normalized.length % 2 !== 0 || !HEX_PATTERN.test(normalized)) {
    throw new Error("Invalid public key encoding.");
  }

  return Uint8Array.from(normalized.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
}

function parseBase64UrlBytes(value: string): Uint8Array | null {
  if (!BASE64URL_PATTERN.test(value)) {
    return null;
  }

  const normalized = `${value}${"=".repeat((4 - (value.length % 4 || 4)) % 4)}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const bytes: number[] = [];

  for (let index = 0; index < normalized.length; index += 4) {
    const chunk = normalized.slice(index, index + 4);
    const values = [...chunk].map((character) => decodeBase64Value(character));

    if (values[0] === null || values[1] === null || values[2] === null || values[3] === null) {
      return null;
    }

    const combined = (values[0] << 18) | (values[1] << 12) | (values[2] << 6) | values[3];

    bytes.push((combined >> 16) & 0xff);
    if (chunk[2] !== "=") {
      bytes.push((combined >> 8) & 0xff);
    }
    if (chunk[3] !== "=") {
      bytes.push(combined & 0xff);
    }
  }

  return Uint8Array.from(bytes);
}

function decodeBase64Value(character: string): number | null {
  if (character === "=") {
    return 0;
  }

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const index = alphabet.indexOf(character);
  return index >= 0 ? index : null;
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  return Uint8Array.from(value).buffer;
}
