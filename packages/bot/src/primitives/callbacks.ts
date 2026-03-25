import { CALLBACK_PREFIX, hmacTag, verifySignature } from "./shared.js";

import type {
  TelegramCallbackQuery,
  TelegramInlineKeyboardButton,
  TelegramUpdate
} from "../router/types.js";

export interface FlowCallbackOptions {
  action: string;
  data?: Record<string, unknown>;
  flowId: string;
  text: string;
}

export interface FlowCallbackData {
  action: string;
  callbackQueryId?: string;
  data: Record<string, unknown>;
  flowId: string;
  originMessageId?: number;
  userId?: number;
}

export type FlowCallbackSource = TelegramCallbackQuery | TelegramUpdate | string;

/**
 * Creates a signed callback button for chat-side flow steps.
 *
 * The encoded payload is kept within Telegram's callback-data limit and throws when the supplied
 * flow data cannot fit safely.
 *
 * @example
 * ```ts
 * const button = createFlowCallback(
 *   { text: "Confirm", flowId: "task-shop", action: "confirm" },
 *   "secret"
 * );
 * ```
 */
export function createFlowCallback(
  options: FlowCallbackOptions,
  secret: string
): TelegramInlineKeyboardButton {
  const body = serializeCallbackBody(options);
  const signature = hmacTag(body, secret, 4).toString("hex");
  const callbackData = `${CALLBACK_PREFIX}:${body}:${signature}`;

  if (callbackData.length > 64) {
    throw new Error("Flow callback payload exceeds Telegram's 64-byte callback_data limit.");
  }

  return {
    callback_data: callbackData,
    text: options.text
  };
}

/**
 * Validates and decodes signed callback data from a callback query or raw callback token.
 *
 * @example
 * ```ts
 * const callback = handleFlowCallback(update, "secret");
 * ```
 */
export function handleFlowCallback(
  source: FlowCallbackSource,
  secret: string
): FlowCallbackData | null {
  const callbackQuery = resolveCallbackQuery(source);
  const encoded = callbackQuery?.data ?? (typeof source === "string" ? source : null);

  if (!encoded) {
    return null;
  }

  const prefix = `${CALLBACK_PREFIX}:`;
  const lastSeparatorIndex = encoded.lastIndexOf(":");

  if (!encoded.startsWith(prefix) || lastSeparatorIndex <= prefix.length) {
    return null;
  }

  const body = encoded.slice(prefix.length, lastSeparatorIndex);
  const signature = encoded.slice(lastSeparatorIndex + 1);

  if (!verifySignature(body, Buffer.from(signature, "hex").toString("base64url"), secret, 4)) {
    return null;
  }

  const decoded = parseCallbackBody(body);
  if (!decoded) {
    return null;
  }

  return {
    action: decoded.action,
    callbackQueryId: callbackQuery?.id,
    data: decoded.data,
    flowId: decoded.flowId,
    originMessageId:
      typeof callbackQuery?.message?.message_id === "number"
        ? callbackQuery.message.message_id
        : undefined,
    userId: typeof callbackQuery?.from?.id === "number" ? callbackQuery.from.id : undefined
  };
}

function resolveCallbackQuery(source: FlowCallbackSource): TelegramCallbackQuery | null {
  if (typeof source === "string") {
    return null;
  }

  if ("from" in source) {
    return source;
  }

  return source.callback_query ?? null;
}

function parseCallbackBody(value: string): {
  action: string;
  data: Record<string, unknown>;
  flowId: string;
} | null {
  const params = new URLSearchParams(value);
  const flowId = params.get("f");
  const action = params.get("a");

  if (!flowId || !action) {
    return null;
  }

  const data: Record<string, unknown> = {};

  for (const [key, rawValue] of params.entries()) {
    if (!key.startsWith("d.")) {
      continue;
    }

    data[key.slice(2)] = decodeScalar(rawValue);
  }

  return {
    action,
    data,
    flowId
  };
}

function serializeCallbackBody(options: FlowCallbackOptions): string {
  const params = new URLSearchParams({
    a: options.action,
    f: options.flowId
  });

  for (const [key, value] of Object.entries(options.data ?? {})) {
    params.set(`d.${key}`, encodeScalar(value));
  }

  return params.toString();
}

function encodeScalar(value: unknown): string {
  switch (typeof value) {
    case "boolean":
      return `b:${value ? "1" : "0"}`;
    case "number":
      return `n:${value}`;
    case "string":
      return `s:${value}`;
    default:
      if (value === null) {
        return "z:";
      }
  }

  throw new Error("Flow callback data only supports flat string, number, boolean, or null values.");
}

function decodeScalar(value: string): unknown {
  const prefix = value.slice(0, 2);
  const raw = value.slice(2);

  switch (prefix) {
    case "b:":
      return raw === "1";
    case "n:":
      return Number(raw);
    case "s:":
      return raw;
    case "z:":
      return null;
    default:
      return value;
  }
}
