import {
  parseInitDataUnsafe,
  parseLaunchContext,
  validateInitDataEd25519,
  type LaunchMode,
  type WebAppInitData,
  type WebAppUser
} from "@teleforgex/core/browser";

import { BffContextError } from "./errors.js";

import type { BffChatType, BffContextOptions } from "./types.js";

export interface ParsedBffInitData {
  authType: "none" | "telegram";
  chatInstance: string | null;
  chatType: BffChatType;
  initData: WebAppInitData;
  initDataRaw: string | null;
  launchMode: LaunchMode;
  startParam: string | null;
  telegramUser: WebAppUser | null;
}

export async function parseBffInitData(
  request: Request,
  options: BffContextOptions
): Promise<ParsedBffInitData> {
  const initDataRaw = readInitDataRaw(request);
  const launchContext = parseRequestLaunchContext(request, initDataRaw);
  const fallbackInitData = initDataRaw ? parseInitDataUnsafe(initDataRaw) : {};

  if (!options.validateInitData) {
    return {
      authType: "none",
      chatInstance:
        launchContext.initDataUnsafe.chat_instance ?? fallbackInitData.chat_instance ?? null,
      chatType: normalizeChatType(
        launchContext.initDataUnsafe.chat_type ?? fallbackInitData.chat_type ?? null
      ),
      initData: fallbackInitData,
      initDataRaw,
      launchMode: launchContext.launchMode,
      startParam: launchContext.startParam ?? fallbackInitData.start_param ?? null,
      telegramUser: null
    };
  }

  if (!initDataRaw) {
    throw new BffContextError(
      "MISSING_VALIDATION_CREDENTIALS",
      401,
      "Telegram initData is required when validateInitData is enabled."
    );
  }

  const validated = await validateTelegramInitData(initDataRaw, options);

  return {
    authType: "telegram",
    chatInstance: validated.chat_instance ?? null,
    chatType: normalizeChatType(validated.chat_type ?? null),
    initData: validated,
    initDataRaw,
    launchMode: launchContext.launchMode,
    startParam: validated.start_param ?? launchContext.startParam ?? null,
    telegramUser: validated.user ?? null
  };
}

function normalizeChatType(chatType: string | null): BffChatType {
  switch (chatType) {
    case "channel":
    case "group":
    case "private":
    case "sender":
    case "supergroup":
      return chatType;
    default:
      return null;
  }
}

function parseRequestLaunchContext(request: Request, initDataRaw: string | null) {
  const url = new URL(request.url);
  const params = new URLSearchParams(url.search);

  if (initDataRaw) {
    params.set("tgWebAppData", initDataRaw);
  }

  return parseLaunchContext(params);
}

function readInitDataRaw(request: Request): string | null {
  const url = new URL(request.url);

  return (
    request.headers.get("x-telegram-init-data") ??
    request.headers.get("telegram-init-data") ??
    request.headers.get("x-teleforge-init-data") ??
    url.searchParams.get("tgWebAppData") ??
    url.searchParams.get("initData") ??
    null
  );
}

async function validateTelegramInitData(
  initDataRaw: string,
  options: BffContextOptions
): Promise<WebAppInitData> {
  if (options.publicKey) {
    if (
      typeof options.botId !== "number" ||
      !Number.isInteger(options.botId) ||
      options.botId <= 0
    ) {
      throw new BffContextError(
        "MISSING_BOT_ID",
        500,
        "Ed25519 validation requires a numeric botId."
      );
    }

    if (options.botToken) {
      console.warn(
        "Teleforge BFF context received both publicKey and botToken; preferring Ed25519 validation."
      );
    }

    const result = await validateInitDataEd25519(initDataRaw, options.publicKey, {
      botId: options.botId
    });

    if (!result.valid) {
      throw new BffContextError("INVALID_INIT_DATA", 401, result.error);
    }

    return result.data;
  }

  if (options.botToken) {
    if (!isNodeRuntime()) {
      throw new BffContextError(
        "RUNTIME_UNSUPPORTED_VALIDATION",
        500,
        "Bot-token initData validation is only available in Node runtimes."
      );
    }

    const core = await import("@teleforgex/core");
    const result = core.validateInitDataBotToken(initDataRaw, options.botToken);

    if (!result.valid) {
      throw new BffContextError("INVALID_INIT_DATA", 401, result.error);
    }

    return result.data;
  }

  throw new BffContextError(
    "MISSING_VALIDATION_CREDENTIALS",
    500,
    "validateInitData requires either publicKey+botId or botToken."
  );
}

function isNodeRuntime(): boolean {
  return typeof process !== "undefined" && process.versions?.node !== undefined;
}
