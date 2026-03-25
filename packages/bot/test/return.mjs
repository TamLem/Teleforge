import assert from "node:assert/strict";
import test from "node:test";

import { UserFlowStateManager, createFlowStorage } from "@teleforge/core";

import { createSignedPayload, handleMiniAppReturnData } from "../dist/index.js";

const secret = "coord-secret";

test("handleMiniAppReturnData consumes a valid coordinated return payload", async () => {
  const storage = new UserFlowStateManager(
    createFlowStorage({
      backend: "memory",
      defaultTTL: 60
    })
  );
  const stateKey = await storage.startFlow("42", "task-shop-browse", "catalog");
  const flowContext = createSignedPayload(
    {
      flowId: "task-shop-browse",
      payload: {
        stateKey
      },
      stepId: "catalog"
    },
    secret
  );
  const replies = [];
  const answers = [];

  const handled = await handleMiniAppReturnData(
    createContext(
      {
        data: {
          order: {
            items: [],
            total: 0
          }
        },
        flowContext,
        result: "completed",
        stateKey,
        type: "miniapp_return"
      },
      replies,
      answers
    ),
    storage,
    secret,
    {
      async onCancel() {},
      async onComplete(state, data) {
        replies.push({
          flowId: state.flowId,
          type: data.order ? "order" : "unknown"
        });
      },
      async onError() {}
    }
  );

  assert.equal(handled, true);
  assert.equal(await storage.getState(stateKey), null);
  assert.deepEqual(replies[0], {
    flowId: "task-shop-browse",
    type: "order"
  });
  assert.equal(answers[0], "Returned to chat");
});

test("handleMiniAppReturnData ignores non-return payloads", async () => {
  const storage = new UserFlowStateManager(
    createFlowStorage({
      backend: "memory",
      defaultTTL: 60
    })
  );

  const handled = await handleMiniAppReturnData(
    createContext(
      {
        type: "order_completed"
      },
      [],
      []
    ),
    storage,
    secret,
    {
      async onCancel() {},
      async onComplete() {},
      async onError() {}
    }
  );

  assert.equal(handled, false);
});

function createContext(payload, replies, answers) {
  return {
    async answer(text) {
      answers.push(text);
    },
    payload,
    async reply(text) {
      replies.push(text);
      return {
        chat: {
          id: 1
        }
      };
    }
  };
}
