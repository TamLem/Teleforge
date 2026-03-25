import type { ReplyOptions } from "../router/types.js";

export function createWebAppReplyOptions(buttonText: string, url: string): ReplyOptions {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: buttonText,
            web_app: {
              url
            }
          }
        ]
      ]
    }
  };
}
