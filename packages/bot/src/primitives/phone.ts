import { createSignedPhoneAuthToken, normalizePhoneNumber } from "@teleforgex/core";

import type {
  TelegramContact,
  TelegramKeyboardButton,
  TelegramKeyboardMarkup,
  TelegramMessage,
  TelegramUpdate
} from "../router/types.js";

export interface PhoneNumberRequestButtonOptions {
  text?: string;
}

export interface PhoneNumberRequestMarkupOptions {
  oneTimeKeyboard?: boolean;
  resizeKeyboard?: boolean;
  text?: string;
}

export interface SharedPhoneContact {
  contact: TelegramContact;
  normalizedPhoneNumber: string;
  phoneNumber: string;
  telegramUserId: number;
}

export interface CreatePhoneAuthLinkOptions {
  expiresAt?: number;
  issuedAt?: number;
  phoneNumber: string;
  secret: string;
  telegramUserId: number;
  ttlMs?: number;
  webAppUrl: string;
}

export type PhoneContactSource = TelegramMessage | TelegramUpdate;

export function createPhoneNumberRequestButton(
  options: PhoneNumberRequestButtonOptions = {}
): TelegramKeyboardButton {
  return {
    request_contact: true,
    text: options.text ?? "Share phone number"
  };
}

export function createPhoneNumberRequestMarkup(
  options: PhoneNumberRequestMarkupOptions = {}
): TelegramKeyboardMarkup {
  return {
    keyboard: [[createPhoneNumberRequestButton({ text: options.text })]],
    one_time_keyboard: options.oneTimeKeyboard ?? true,
    resize_keyboard: options.resizeKeyboard ?? true
  };
}

export async function createPhoneAuthLink(options: CreatePhoneAuthLinkOptions): Promise<string> {
  const token = await createSignedPhoneAuthToken(
    {
      expiresAt: options.expiresAt,
      issuedAt: options.issuedAt,
      phoneNumber: options.phoneNumber,
      telegramUserId: options.telegramUserId
    },
    options.secret,
    {
      ...(options.expiresAt !== undefined ? { expiresAt: options.expiresAt } : {}),
      ...(options.issuedAt !== undefined ? { issuedAt: options.issuedAt } : {}),
      ...(options.ttlMs !== undefined ? { ttlMs: options.ttlMs } : {})
    }
  );
  const url = new URL(options.webAppUrl);

  url.searchParams.set("tfPhoneAuth", token);

  return url.toString();
}

export function extractSharedPhoneContact(source: PhoneContactSource): SharedPhoneContact | null {
  const message = isTelegramUpdate(source)
    ? (source.message ?? source.edited_message ?? null)
    : source;
  const contact = message?.contact;
  const sender = message?.from;

  if (!contact || !sender) {
    return null;
  }

  if (typeof contact.user_id === "number" && contact.user_id !== sender.id) {
    return null;
  }

  const normalizedPhoneNumber = normalizePhoneNumber(contact.phone_number);

  if (!normalizedPhoneNumber) {
    return null;
  }

  return {
    contact,
    normalizedPhoneNumber,
    phoneNumber: contact.phone_number,
    telegramUserId: sender.id
  };
}

function isTelegramUpdate(source: PhoneContactSource): source is TelegramUpdate {
  return "update_id" in source || "message" in source || "edited_message" in source;
}
