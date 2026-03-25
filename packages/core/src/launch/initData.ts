import type { ParseInitDataResult, WebAppChat, WebAppInitData, WebAppUser } from "./types.js";

export function parseInitData(initData: string): ParseInitDataResult {
  const errors: string[] = [];
  const data = parseInitDataInternal(initData, errors);

  if (errors.length > 0) {
    return {
      error: errors[0] ?? "Invalid initData payload.",
      success: false
    };
  }

  return {
    data,
    success: true
  };
}

export function parseInitDataUnsafe(initData: string): WebAppInitData {
  return parseInitDataInternal(initData);
}

function parseInitDataInternal(initData: string, errors?: string[]): WebAppInitData {
  if (initData.trim().length === 0) {
    return {};
  }

  const params = new URLSearchParams(initData);
  const data: WebAppInitData = {};
  const queryId = optionalString(params.get("query_id"));
  const startParam = optionalString(params.get("start_param"));
  const hash = optionalString(params.get("hash"));
  const chatInstance = optionalString(params.get("chat_instance"));
  const chatType = optionalString(params.get("chat_type"));

  if (queryId) {
    data.query_id = queryId;
  }

  if (startParam) {
    data.start_param = startParam;
  }

  if (hash) {
    data.hash = hash;
  }

  if (chatInstance) {
    data.chat_instance = chatInstance;
  }

  if (chatType) {
    data.chat_type = chatType;
  }

  const authDate = parseIntegerField(params.get("auth_date"), "auth_date", errors);
  if (authDate !== undefined) {
    data.auth_date = authDate;
  }

  const canSendAfter = parseIntegerField(params.get("can_send_after"), "can_send_after", errors);
  if (canSendAfter !== undefined) {
    data.can_send_after = canSendAfter;
  }

  const user = parseJsonField(params.get("user"), "user", coerceUser, errors);
  if (user) {
    data.user = user;
  }

  const receiver = parseJsonField(params.get("receiver"), "receiver", coerceUser, errors);
  if (receiver) {
    data.receiver = receiver;
  }

  const chat = parseJsonField(params.get("chat"), "chat", coerceChat, errors);
  if (chat) {
    data.chat = chat;
  }

  return data;
}

function parseIntegerField(
  value: string | null,
  fieldName: string,
  errors?: string[]
): number | undefined {
  if (value === null || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    errors?.push(`Invalid ${fieldName} in initData.`);
    return undefined;
  }

  return parsed;
}

function parseJsonField<T>(
  value: string | null,
  fieldName: string,
  coerce: (input: unknown) => T | undefined,
  errors?: string[]
): T | undefined {
  if (value === null || value.trim().length === 0) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    const coerced = coerce(parsed);

    if (coerced === undefined) {
      errors?.push(`Invalid ${fieldName} payload in initData.`);
    }

    return coerced;
  } catch {
    errors?.push(`Invalid ${fieldName} JSON in initData.`);
    return undefined;
  }
}

function coerceUser(input: unknown): WebAppUser | undefined {
  if (!isRecord(input)) {
    return undefined;
  }

  const id = optionalNumber(input.id);
  const firstName = optionalString(input.first_name);

  if (id === undefined || !firstName) {
    return undefined;
  }

  return {
    added_to_attachment_menu: optionalBoolean(input.added_to_attachment_menu),
    allows_write_to_pm: optionalBoolean(input.allows_write_to_pm),
    first_name: firstName,
    id,
    is_bot: optionalBoolean(input.is_bot),
    is_premium: optionalBoolean(input.is_premium),
    language_code: optionalString(input.language_code),
    last_name: optionalString(input.last_name),
    photo_url: optionalString(input.photo_url),
    username: optionalString(input.username)
  };
}

function coerceChat(input: unknown): WebAppChat | undefined {
  if (!isRecord(input)) {
    return undefined;
  }

  const id = optionalNumber(input.id);
  const type = optionalString(input.type);
  const title = optionalString(input.title);

  if (id === undefined || !type || !title) {
    return undefined;
  }

  return {
    id,
    photo_url: optionalString(input.photo_url),
    title,
    type,
    username: optionalString(input.username)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
