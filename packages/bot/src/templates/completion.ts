import type { MiniAppReturnData } from "../coordination/handle-return.js";
import type { ReplyOptions } from "../router/types.js";
import type { FlowInstance } from "@teleforgex/core";

export interface CompletionMessage {
  options: ReplyOptions;
  text: string;
}

export function createCompletionMessage(
  instance: FlowInstance,
  result: MiniAppReturnData
): CompletionMessage {
  const order = isOrderLike(result.data?.order) ? result.data.order : null;
  const lines = [
    `*${instance.flowId}* ${describeResult(result.result)}.`,
    `Step: ${instance.stepId}`,
    ...(order ? [`Items: ${order.items.length}`, `Total: ${order.total} Stars`] : []),
    ...(result.returnMessage ? [result.returnMessage] : [])
  ];

  return {
    options: {
      parse_mode: "Markdown"
    },
    text: lines.join("\n")
  };
}

function describeResult(result: MiniAppReturnData["result"]): string {
  switch (result) {
    case "cancelled":
      return "cancelled";
    case "error":
      return "failed";
    default:
      return "completed";
  }
}

function isOrderLike(value: unknown): value is {
  items: unknown[];
  total: number;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "items" in value &&
    Array.isArray(value.items) &&
    "total" in value &&
    typeof value.total === "number"
  );
}
