import type { TelegramInlineKeyboardButton } from "../router/types.js";

export interface MiniAppButtonOptions {
  requestWriteAccess?: boolean;
  startPayload?: string;
  stayInChat?: boolean;
  text: string;
  webAppUrl: string;
}

/**
 * Creates an inline keyboard button that launches a Mini App.
 *
 * Optional coordination hints are encoded into the launch URL so later flow layers can recover
 * them without widening the Telegram button shape.
 *
 * @example
 * ```ts
 * const button = createMiniAppButton({
 *   text: "Open Task Shop",
 *   webAppUrl: "https://example.ngrok.app",
 *   startPayload: "signed-flow"
 * });
 * ```
 */
export function createMiniAppButton(options: MiniAppButtonOptions): TelegramInlineKeyboardButton {
  if (!options.text) {
    throw new Error("Mini App buttons require non-empty text.");
  }

  const url = new URL(options.webAppUrl);

  if (options.startPayload) {
    url.searchParams.set("tgWebAppStartParam", options.startPayload);
  }

  if (options.requestWriteAccess) {
    url.searchParams.set("tfRequestWriteAccess", "1");
  }

  if (typeof options.stayInChat === "boolean") {
    url.searchParams.set("tfStayInChat", options.stayInChat ? "1" : "0");
  }

  return {
    text: options.text,
    web_app: {
      url: url.toString()
    }
  };
}
