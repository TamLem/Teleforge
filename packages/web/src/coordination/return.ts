import { getTelegramWebApp } from "../utils/ssr.js";

import { getLaunchFlowContext, inferStateKey } from "./shared.js";
import { transmitResult, type TransmitConfig } from "./transmit.js";

export interface ReturnToChatOptions {
  data?: Record<string, unknown>;
  flowContext?: string;
  result: "cancelled" | "completed" | "error";
  returnMessage?: string;
  stateKey?: string;
}

/**
 * Transmits a coordinated Mini App result back to chat and closes the Mini App when possible.
 */
export async function returnToChat(
  options: ReturnToChatOptions,
  config: TransmitConfig = {}
): Promise<void> {
  const resolved = resolveReturnOptions(options);

  await transmitResult(resolved, config);

  getTelegramWebApp()?.close();
}

export async function completeFlow(
  data: Record<string, unknown> = {},
  options: Omit<ReturnToChatOptions, "data" | "result"> = {}
): Promise<void> {
  await returnToChat({
    ...options,
    data,
    result: "completed"
  });
}

export async function cancelFlow(
  reason?: string,
  options: Omit<ReturnToChatOptions, "data" | "result"> = {}
): Promise<void> {
  await returnToChat({
    ...options,
    data: reason ? { reason } : {},
    result: "cancelled"
  });
}

function resolveReturnOptions(options: ReturnToChatOptions): Required<ReturnToChatOptions> {
  const flowContext = options.flowContext ?? getLaunchFlowContext();
  const stateKey = options.stateKey ?? inferStateKey(flowContext);

  if (!flowContext || !stateKey) {
    throw new Error("Unable to infer flow context for return-to-chat.");
  }

  return {
    data: options.data ?? {},
    flowContext,
    result: options.result,
    returnMessage: options.returnMessage ?? "",
    stateKey
  };
}
