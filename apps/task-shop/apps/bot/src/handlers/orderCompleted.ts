import type { OrderPayload } from "@task-shop/types";
import type { WebAppDataHandler } from "@teleforge/bot";

export const orderCompletedHandler: WebAppDataHandler = async (context) => {
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

  await context.reply(
    [
      "✅ Task Shop order received",
      `User: ${userLabel}`,
      `Tasks: ${taskSummary}`,
      `Total: ${context.payload.total} Stars`
    ].join("\n"),
    context.messageId === null
      ? undefined
      : {
          reply_to_message_id: context.messageId
        }
  );

  await context.answer("Order confirmed");
};

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
