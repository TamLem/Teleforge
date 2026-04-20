import { extractFlowContext } from "../primitives/context.js";
import { createCompletionMessage } from "../templates/completion.js";

import type { WebAppDataContext } from "../router/types.js";
import type { FlowInstance, UserFlowStateManager } from "@teleforgex/core";

export interface MiniAppReturnData {
  data: Record<string, unknown>;
  flowContext: string;
  result: "cancelled" | "completed" | "error";
  returnMessage?: string;
  stateKey: string;
  type: "miniapp_return";
}

export interface ReturnHandlers {
  onCancel: (instance: FlowInstance, reason?: string) => Promise<void>;
  onComplete: (instance: FlowInstance, data: Record<string, unknown>) => Promise<void>;
  onError: (instance: FlowInstance | null, error: Error) => Promise<void>;
}

export async function handleMiniAppReturnData(
  context: WebAppDataContext,
  storage: UserFlowStateManager,
  secret: string,
  handlers: ReturnHandlers
): Promise<boolean> {
  const payload = parseMiniAppReturnData(context.payload);

  if (!payload) {
    return false;
  }

  const flowContext = extractFlowContext(payload.flowContext, secret);
  if (!flowContext || flowContext.payload.stateKey !== payload.stateKey) {
    const error = new Error("Mini App return payload could not be verified.");
    await handlers.onError(null, error);
    await context.answer("Could not verify Mini App return payload");
    return true;
  }

  const instance = await storage.getInstance(payload.stateKey);
  if (!instance) {
    const error = new Error("Mini App return payload references an expired or missing flow instance.");
    await handlers.onError(null, error);
    await context.answer("Flow expired before return");
    return true;
  }

  if (payload.result === "completed") {
    await handlers.onComplete(instance, payload.data);
    await storage.completeInstance(payload.stateKey);
    await context.answer(payload.returnMessage ?? "Returned to chat");
    return true;
  }

  if (payload.result === "cancelled") {
    const reason = typeof payload.data.reason === "string" ? payload.data.reason : undefined;
    await handlers.onCancel(instance, reason);
    await storage.completeInstance(payload.stateKey);
    await context.answer(payload.returnMessage ?? "Flow cancelled");
    return true;
  }

  const errorMessage =
    typeof payload.data.message === "string" ? payload.data.message : "Mini App flow failed.";
  const error = new Error(errorMessage);

  await storage.failInstance(payload.stateKey, error);
  await handlers.onError(instance, error);
  await context.answer(payload.returnMessage ?? "Mini App reported an error");

  return true;
}

export function createDefaultReturnHandlers(context: WebAppDataContext): ReturnHandlers {
  return {
    async onCancel(state, reason) {
      const message = createCompletionMessage(state, {
        data: reason ? { reason } : {},
        flowContext: "",
        result: "cancelled",
        returnMessage: reason,
        stateKey: "",
        type: "miniapp_return"
      });

      await context.reply(message.text, message.options);
    },
    async onComplete(state, data) {
      const message = createCompletionMessage(state, {
        data,
        flowContext: "",
        result: "completed",
        stateKey: "",
        type: "miniapp_return"
      });

      await context.reply(message.text, message.options);
    },
    async onError(_state, error) {
      await context.reply(`Mini App return failed: ${error.message}`);
    }
  };
}

function parseMiniAppReturnData(payload: unknown): MiniAppReturnData | null {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("type" in payload) ||
    payload.type !== "miniapp_return" ||
    !("stateKey" in payload) ||
    typeof payload.stateKey !== "string" ||
    !("flowContext" in payload) ||
    typeof payload.flowContext !== "string" ||
    !("result" in payload) ||
    (payload.result !== "completed" && payload.result !== "cancelled" && payload.result !== "error")
  ) {
    return null;
  }

  return {
    data:
      "data" in payload && typeof payload.data === "object" && payload.data !== null
        ? (payload.data as Record<string, unknown>)
        : {},
    flowContext: payload.flowContext,
    result: payload.result,
    returnMessage:
      "returnMessage" in payload && typeof payload.returnMessage === "string"
        ? payload.returnMessage
        : undefined,
    stateKey: payload.stateKey,
    type: "miniapp_return"
  };
}
