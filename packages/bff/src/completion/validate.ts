import { BffError } from "../errors/base.js";
import { BffErrorCodes } from "../errors/codes.js";

import type { CompletionAction } from "./types.js";

export function validateCompletionAction(action: CompletionAction): CompletionAction {
  switch (action.type) {
    case "sendMessage":
      assertChatId(action.chatId, action.type);
      assertNonEmptyString(action.text, `${action.type}.text`);
      return action;
    case "editMessage":
      assertChatId(action.chatId, action.type);
      assertPositiveInteger(action.messageId, `${action.type}.messageId`);
      assertNonEmptyString(action.text, `${action.type}.text`);
      return action;
    case "sendPhoto":
      assertChatId(action.chatId, action.type);
      assertNonEmptyString(action.photo, `${action.type}.photo`);
      return action;
    case "openInvoice":
      assertNonEmptyString(action.slug, `${action.type}.slug`);
      return action;
    case "close":
      return action;
    case "openLink":
      assertAbsoluteUrl(action.url, `${action.type}.url`);
      return action;
    default:
      throw invalidCompletion(
        `Unsupported completion action: ${String((action as CompletionAction).type)}`
      );
  }
}

function assertAbsoluteUrl(value: string, field: string) {
  assertNonEmptyString(value, field);

  try {
    new URL(value);
  } catch {
    throw invalidCompletion(`${field} must be a valid absolute URL.`);
  }
}

function assertChatId(value: number, field: string) {
  if (!Number.isInteger(value)) {
    throw invalidCompletion(`${field}.chatId must be an integer.`);
  }
}

function assertNonEmptyString(value: string, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalidCompletion(`${field} must be a non-empty string.`);
  }
}

function assertPositiveInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw invalidCompletion(`${field} must be a positive integer.`);
  }
}

function invalidCompletion(message: string) {
  return BffError.fromCode(BffErrorCodes.INVALID_COMPLETION_CONFIG, {
    message
  });
}
