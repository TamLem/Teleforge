import {
  SIGNED_FLOW_CONTEXT_PREFIX,
  createSignedFlowContext,
  verifySignedFlowContext
} from "@teleforge/core";

import { isRecord, parseJsonRecord } from "./shared.js";

import type { TelegramMessage, TelegramUpdate, TelegramWebAppData } from "../router/types.js";
import type { FlowContext as CoreFlowContext } from "@teleforge/core";

export type FlowContext = CoreFlowContext;

export type FlowContextSource = TelegramMessage | TelegramUpdate | TelegramWebAppData | string;

/**
 * Creates a signed, tamper-evident payload string for flow coordination data.
 *
 * @example
 * ```ts
 * const token = createSignedPayload({ flowId: "task-shop", payload: {} }, "secret");
 * ```
 */
export function createSignedPayload(data: Record<string, unknown>, secret: string): string {
  return createSignedFlowContext(data as FlowContext, secret);
}

/**
 * Validates and extracts flow context from a signed payload string, a `web_app_data` payload, or
 * an incoming Telegram update.
 *
 * @example
 * ```ts
 * const context = extractFlowContext(update, "secret");
 * ```
 */
export function extractFlowContext(source: FlowContextSource, secret: string): FlowContext | null {
  const signedPayload = resolveSignedPayload(source);
  if (!signedPayload) {
    return null;
  }

  const parsed = verifySignedPayload(signedPayload, secret);
  if (!parsed || !isFlowContextRecord(parsed)) {
    return null;
  }

  return {
    flowId: parsed.flowId,
    payload: parsed.payload,
    ...(typeof parsed.originMessageId === "number"
      ? { originMessageId: parsed.originMessageId }
      : {}),
    ...(typeof parsed.requestWriteAccess === "boolean"
      ? { requestWriteAccess: parsed.requestWriteAccess }
      : {}),
    ...(typeof parsed.returnText === "string" ? { returnText: parsed.returnText } : {}),
    ...(typeof parsed.stayInChat === "boolean" ? { stayInChat: parsed.stayInChat } : {}),
    ...(typeof parsed.stepId === "string" ? { stepId: parsed.stepId } : {})
  };
}

export function verifySignedPayload(signedPayload: string, secret: string): FlowContext | null {
  return verifySignedFlowContext(signedPayload, secret);
}

function isFlowContextRecord(value: Record<string, unknown>): value is Record<string, unknown> & {
  flowId: string;
  payload: Record<string, unknown>;
} {
  return typeof value.flowId === "string" && isRecord(value.payload);
}

function resolveSignedPayload(source: FlowContextSource): string | null {
  if (typeof source === "string") {
    return extractSignedPayloadCandidate(source);
  }

  if (isTelegramUpdate(source)) {
    return (
      extractSignedPayloadCandidate(source.callback_query?.data) ??
      extractSignedPayloadCandidate(source.message?.web_app_data?.data) ??
      extractSignedPayloadCandidate(source.edited_message?.web_app_data?.data)
    );
  }

  if (isTelegramMessage(source)) {
    return extractSignedPayloadCandidate(source.web_app_data?.data);
  }

  return extractSignedPayloadCandidate(source.data);
}

function extractSignedPayloadCandidate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  if (value.startsWith(`${SIGNED_FLOW_CONTEXT_PREFIX}.`)) {
    return value;
  }

  const parsed = parseJsonRecord(value);
  if (!parsed) {
    return null;
  }

  if (typeof parsed.flowContext === "string") {
    return parsed.flowContext;
  }

  if (typeof parsed.signedPayload === "string") {
    return parsed.signedPayload;
  }

  return null;
}

function isTelegramMessage(value: FlowContextSource): value is TelegramMessage {
  return typeof value === "object" && value !== null && "chat" in value;
}

function isTelegramUpdate(value: FlowContextSource): value is TelegramUpdate {
  return (
    typeof value === "object" &&
    value !== null &&
    ("callback_query" in value ||
      "edited_message" in value ||
      "message" in value ||
      "update_id" in value)
  );
}
