import assert from "node:assert/strict";
import test from "node:test";

import { createFlowCallback, handleFlowCallback } from "../../dist/index.js";

const secret = "coord-secret";

test("createFlowCallback and handleFlowCallback round-trip small flow state", () => {
  const button = createFlowCallback(
    {
      action: "confirm",
      data: {
        item: "task-001"
      },
      flowId: "task-shop",
      text: "Confirm"
    },
    secret
  );
  const callback = handleFlowCallback(
    {
      callback_query: {
        data: button.callback_data,
        from: {
          first_name: "Dev",
          id: 42
        },
        id: "cb-1",
        message: {
          chat: {
            id: 1001
          },
          message_id: 17
        }
      },
      update_id: 9
    },
    secret
  );

  assert.deepEqual(callback, {
    action: "confirm",
    callbackQueryId: "cb-1",
    data: {
      item: "task-001"
    },
    flowId: "task-shop",
    originMessageId: 17,
    userId: 42
  });
});

test("createFlowCallback rejects payloads that exceed Telegram callback limits", () => {
  assert.throws(
    () =>
      createFlowCallback(
        {
          action: "confirm",
          data: {
            oversized: "this-payload-is-too-large-for-telegram-callback-data"
          },
          flowId: "task-shop",
          text: "Confirm"
        },
        secret
      ),
    /64-byte callback_data limit/
  );
});
