import { generateMiniAppLink } from "@teleforgex/core";

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

  return {
    text: options.text,
    web_app: {
      url: options.startPayload
        ? generateMiniAppLink({
            requestWriteAccess: options.requestWriteAccess,
            startPayload: options.startPayload,
            stayInChat: options.stayInChat,
            webAppUrl: options.webAppUrl
          })
        : options.webAppUrl
    }
  };
}
