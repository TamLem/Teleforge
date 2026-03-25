import {
  createWebAppReplyOptions,
  handleMiniAppReturnData,
  type WebAppDataHandler
} from "@teleforge/bot";

import type { OrderPayload } from "@task-shop/types";
import type { UserFlowStateManager } from "@teleforge/core";

export function createOrderCompletedHandler(
  flowStateManager: UserFlowStateManager,
  coordinationSecret: string,
  miniAppUrl: string
): WebAppDataHandler {
  return async (context) => {
    const consumed = await handleMiniAppReturnData(context, flowStateManager, coordinationSecret, {
      async onCancel(state, reason) {
        await context.reply(
          [`Flow cancelled: ${state.flowId}`, ...(reason ? [reason] : [])].join("\n"),
          createWebAppReplyOptions("Start New Task", miniAppUrl)
        );
      },
      async onComplete(state, data) {
        const order = isOrderPayload(data.order) ? data.order : null;

        await context.reply(
          [
            "✅ Task Shop return received",
            `Flow: ${state.flowId}`,
            ...(order ? [`Tasks: ${order.items.map((item) => item.title).join(", ")}`] : []),
            ...(order ? [`Total: ${order.total} Stars`] : [])
          ].join("\n"),
          createWebAppReplyOptions("Start New Task", miniAppUrl)
        );
      },
      async onError(state, error) {
        await context.reply(
          [
            "Mini App return failed",
            ...(state ? [`Flow: ${state.flowId}`] : []),
            error.message
          ].join("\n")
        );
      }
    });

    if (consumed) {
      return;
    }

    if (!isOrderPayload(context.payload)) {
      await context.answer("Received Mini App data");
      return;
    }

    const taskSummary = context.payload.items
      .map((item) => `${item.title} x${item.quantity}`)
      .join(", ");
    const userLabel = context.user?.username
      ? `@${context.user.username}`
      : context.user?.id
        ? `user ${context.user.id}`
        : "unknown user";
    const activeFlow =
      context.user?.id === undefined
        ? null
        : await flowStateManager.resumeFlow(String(context.user.id), "task-shop-browse");

    if (activeFlow && context.user?.id !== undefined) {
      await flowStateManager.completeFlow(
        flowStateManager.createStateKey(String(context.user.id), activeFlow.flowId)
      );
    }

    await context.reply(
      [
        "✅ Task Shop order received",
        `User: ${userLabel}`,
        `Tasks: ${taskSummary}`,
        `Total: ${context.payload.total} Stars`,
        ...(activeFlow ? [`Completed flow: ${activeFlow.flowId}`] : [])
      ].join("\n"),
      context.messageId === null
        ? undefined
        : {
            reply_to_message_id: context.messageId
          }
    );

    await context.answer("Order confirmed");
  };
}

function isOrderPayload(value: unknown): value is OrderPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "order_completed" &&
    "total" in value &&
    typeof value.total === "number" &&
    "items" in value &&
    Array.isArray(value.items)
  );
}
