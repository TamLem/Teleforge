import { createHmac, timingSafeEqual } from "node:crypto";

import { parseInitData } from "../launch/initData.js";

import {
  buildDataCheckString as buildSignedDataCheckString,
  normalizeMaxAge,
  parseAuthDate
} from "./utils.js";

import type { ValidateInitDataOptions, ValidateInitDataResult } from "./types.js";
const HASH_HEX_PATTERN = /^[0-9a-f]{64}$/i;
const WEB_APP_DATA_KEY = "WebAppData";

/**
 * Validates Telegram Mini App `initData` using the bot-token HMAC flow described by Telegram.
 *
 * @param initData Raw `initData` querystring received from the Telegram WebApp bridge.
 * @param botToken Bot token issued by BotFather for the current Mini App.
 * @param options Optional expiration controls for the validation step.
 */
export function validateInitDataBotToken(
  initData: string,
  botToken: string,
  options: ValidateInitDataOptions = {}
): ValidateInitDataResult {
  if (botToken.trim().length === 0) {
    return {
      error: "Bot token is required.",
      valid: false
    };
  }

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");

  if (!receivedHash) {
    return {
      error: "Missing hash field.",
      valid: false
    };
  }

  if (!HASH_HEX_PATTERN.test(receivedHash)) {
    return {
      error: "Invalid hash encoding.",
      valid: false
    };
  }

  const authDate = parseAuthDate(params.get("auth_date"));
  if (authDate === null) {
    return {
      error: "Invalid auth_date field.",
      valid: false
    };
  }

  const dataCheckString = buildSignedDataCheckString(params);
  const secretKey = createHmac("sha256", WEB_APP_DATA_KEY).update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (!safeCompareHash(computedHash, receivedHash)) {
    return {
      error: "Invalid hash.",
      valid: false
    };
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
    return {
      error: parsed.error,
      valid: false
    };
  }

  return {
    data: parsed.data,
    valid: true
  };
}

function safeCompareHash(left: string, right: string): boolean {
  if (!HASH_HEX_PATTERN.test(left) || !HASH_HEX_PATTERN.test(right)) {
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
  } catch {
    return false;
  }
}
