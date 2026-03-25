import type {
  BotWebhookRuntime,
  WebhookConfig,
  WebhookHandler,
  WebhookRequest,
  WebhookResult,
  WebhookUpdate
} from "./types.js";

const DEFAULT_MAX_BODY_SIZE = 1024 * 1024;
const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";

export function createWebhookHandler(
  runtime: BotWebhookRuntime,
  config: WebhookConfig = {}
): WebhookHandler {
  return async (request: WebhookRequest): Promise<WebhookResult> => {
    if (request.method.toUpperCase() !== "POST") {
      return {
        description: "Method not allowed.",
        ok: false,
        status: 405
      };
    }

    if (config.secretToken) {
      const providedSecret = getHeader(request.headers, TELEGRAM_SECRET_HEADER);

      if (providedSecret !== config.secretToken) {
        return {
          description: "Invalid secret token.",
          ok: false,
          status: 401
        };
      }
    }

    const update = parseWebhookBody(request.body);

    if (!update) {
      return {
        description: "Invalid update payload.",
        ok: false,
        status: 400
      };
    }

    if (config.allowedUpdates?.length) {
      const updateType = detectUpdateType(update);

      if (!updateType || !config.allowedUpdates.includes(updateType)) {
        return {
          description: "Update ignored by allowedUpdates filter.",
          ok: true,
          status: 200,
          updateId: update.update_id
        };
      }
    }

    try {
      await runtime.handle(update);

      return {
        ok: true,
        status: 200,
        updateId: update.update_id
      };
    } catch (error) {
      return {
        description:
          error instanceof Error && error.message.length > 0 ? error.message : "Runtime error.",
        ok: false,
        status: 500,
        updateId: update.update_id
      };
    }
  };
}

export function parseWebhookBody(body: unknown): WebhookUpdate | null {
  const parsed = typeof body === "string" ? parseJson(body) : body;

  return isTelegramUpdate(parsed) ? parsed : null;
}

export function normalizeHeaders(
  headers: Record<string, string | string[] | undefined> | undefined
): Record<string, string> {
  if (!headers) {
    return {};
  }

  return Object.entries(headers).reduce<Record<string, string>>((normalized, [key, value]) => {
    if (typeof value === "string") {
      normalized[key.toLowerCase()] = value;
    } else if (Array.isArray(value)) {
      normalized[key.toLowerCase()] = value.join(", ");
    }

    return normalized;
  }, {});
}

export function detectUpdateType(update: WebhookUpdate): string | null {
  if (update.message) {
    return "message";
  }

  if (update.edited_message) {
    return "edited_message";
  }

  if (update.callback_query) {
    return "callback_query";
  }

  return null;
}

export function getDefaultMaxBodySize(maxBodySize?: number) {
  return maxBodySize ?? DEFAULT_MAX_BODY_SIZE;
}

export function getHeader(headers: Record<string, string>, name: string): string | undefined {
  return headers[name.toLowerCase()];
}

function isTelegramUpdate(value: unknown): value is WebhookUpdate {
  if (!value || typeof value !== "object") {
    return false;
  }

  const update = value as Record<string, unknown>;

  if (typeof update.update_id !== "number") {
    return false;
  }

  return "message" in update || "edited_message" in update || "callback_query" in update;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
