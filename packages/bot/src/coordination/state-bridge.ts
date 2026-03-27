import { extractFlowContext } from "../primitives/context.js";
import { sendFlowInit } from "../primitives/flow.js";

import type { FlowContextSource, FlowInitOptions } from "../primitives/index.js";
import type { TelegramMessage } from "../router/types.js";
import type { UserFlowStateManager } from "@teleforgex/core";

export interface CoordinatedFlowOptions extends FlowInitOptions {
  initialStep: string;
  userId: string;
}

/**
 * Starts a persisted coordinated flow and sends the signed Mini App launch message.
 *
 * @example
 * ```ts
 * const result = await initiateCoordinatedFlow(bot, manager, {
 *   chatId: 1,
 *   flowId: "task-shop",
 *   initialStep: "catalog",
 *   secret: "coord-secret",
 *   text: "Continue in the Mini App",
 *   userId: "42",
 *   webAppUrl: "https://example.ngrok.app"
 * });
 * ```
 */
export async function initiateCoordinatedFlow(
  bot: {
    sendMessage: (
      chatId: number | string,
      text: string,
      options?: FlowInitOptions["messageOptions"]
    ) => Promise<TelegramMessage>;
  },
  storage: UserFlowStateManager,
  options: CoordinatedFlowOptions
): Promise<{ message: TelegramMessage; stateKey: string }> {
  const stateKey = await storage.startFlow(
    options.userId,
    options.flowId,
    options.initialStep,
    options.payload ?? {},
    String(options.chatId)
  );

  try {
    const message = await sendFlowInit(bot, {
      ...options,
      payload: {
        ...(options.payload ?? {}),
        stateKey
      }
    });

    return {
      message,
      stateKey
    };
  } catch (error) {
    await storage.completeFlow(stateKey);
    throw error;
  }
}

/**
 * Resolves persisted flow state from a signed return payload produced by COORD-001 primitives.
 */
export async function handleMiniAppReturn(
  storage: UserFlowStateManager,
  source: FlowContextSource,
  secret: string
) {
  const context = extractFlowContext(source, secret);
  const stateKey = context?.payload.stateKey;

  if (typeof stateKey !== "string") {
    return null;
  }

  return storage.getState(stateKey);
}
