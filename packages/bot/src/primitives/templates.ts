import type { ReplyOptions } from "../router/types.js";

export interface FlowResult {
  flowId: string;
  outcome?: "cancelled" | "completed" | "failed";
  summary?: string;
}

export interface MessageTemplate {
  options?: Omit<ReplyOptions, "reply_markup">;
  text: string;
}

/**
 * Prebuilt coordination message templates for common chat-to-Mini-App flow states.
 */
export const templates = {
  continueInMiniApp(flowId: string, context: string): MessageTemplate {
    return {
      text: [`Continue in Mini App`, `Flow: ${flowId}`, context].join("\n")
    };
  },
  progressUpdate(step: number, total: number): MessageTemplate {
    return {
      text: `Mini App progress: step ${step} of ${total}.`
    };
  },
  recoveryPrompt(flowId: string): MessageTemplate {
    return {
      text: `We could not complete the ${flowId} flow in chat. Re-open the Mini App to recover your progress.`
    };
  },
  returnToChat(result: FlowResult): MessageTemplate {
    const outcome = result.outcome ?? "completed";

    return {
      text: [
        `Flow ${result.flowId} ${outcome}.`,
        result.summary ?? "Return to chat when you are ready for the next step."
      ].join("\n")
    };
  }
};
