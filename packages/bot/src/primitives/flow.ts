import { createMiniAppButton } from "./buttons.js";
import { createSignedPayload } from "./context.js";

import type { BotInstance, ReplyOptions, TelegramMessage } from "../router/types.js";

export interface FlowInitOptions {
  buttonText?: string;
  chatId: number | string;
  flowId: string;
  messageOptions?: Omit<ReplyOptions, "reply_markup">;
  payload?: Record<string, unknown>;
  requestWriteAccess?: boolean;
  returnText?: string;
  secret: string;
  stayInChat?: boolean;
  stepId?: string;
  text: string;
  webAppUrl: string;
}

/**
 * Sends a coordinated flow-init message with a signed launch payload embedded into the Mini App
 * button URL.
 *
 * @example
 * ```ts
 * await sendFlowInit(bot, {
 *   chatId: 1,
 *   flowId: "task-shop",
 *   secret: "secret",
 *   text: "Continue in the Mini App",
 *   webAppUrl: "https://example.ngrok.app"
 * });
 * ```
 */
export async function sendFlowInit(
  bot: Pick<BotInstance, "sendMessage">,
  options: FlowInitOptions
): Promise<TelegramMessage> {
  const signedPayload = createSignedPayload(
    {
      flowId: options.flowId,
      originMessageId: options.messageOptions?.reply_to_message_id,
      payload: options.payload ?? {},
      requestWriteAccess: options.requestWriteAccess ?? false,
      returnText: options.returnText,
      stayInChat: options.stayInChat ?? false,
      stepId: options.stepId
    },
    options.secret
  );

  return bot.sendMessage(options.chatId, options.text, {
    ...options.messageOptions,
    reply_markup: {
      inline_keyboard: [
        [
          createMiniAppButton({
            requestWriteAccess: options.requestWriteAccess,
            startPayload: signedPayload,
            stayInChat: options.stayInChat,
            text: options.buttonText ?? "Open Mini App",
            webAppUrl: options.webAppUrl
          })
        ]
      ]
    }
  });
}
