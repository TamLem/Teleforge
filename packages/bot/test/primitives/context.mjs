import assert from "node:assert/strict";
import test from "node:test";

import { createSignedPayload, extractFlowContext } from "../../dist/index.js";

const secret = "coord-secret";

test("createSignedPayload produces tamper-evident flow context strings", () => {
  const signed = createSignedPayload(
    {
      flowId: "task-shop-browse",
      payload: {
        source: "start"
      },
      stepId: "catalog"
    },
    secret
  );
  const parsed = extractFlowContext(signed, secret);

  assert.deepEqual(parsed, {
    flowId: "task-shop-browse",
    payload: {
      source: "start"
    },
    stepId: "catalog"
  });

  const tampered = `${signed.slice(0, -1)}x`;
  assert.equal(extractFlowContext(tampered, secret), null);
});

test("extractFlowContext resolves signed payloads nested inside web_app_data JSON", () => {
  const signed = createSignedPayload(
    {
      flowId: "task-shop-checkout",
      originMessageId: 77,
      payload: {
        cartSize: 2
      },
      requestWriteAccess: true,
      returnText: "Back to chat",
      stayInChat: false
    },
    secret
  );
  const parsed = extractFlowContext(
    {
      message: {
        chat: {
          id: 1
        },
        web_app_data: {
          data: JSON.stringify({
            flowContext: signed,
            orderId: "demo"
          })
        }
      },
      update_id: 5
    },
    secret
  );

  assert.deepEqual(parsed, {
    flowId: "task-shop-checkout",
    originMessageId: 77,
    payload: {
      cartSize: 2
    },
    requestWriteAccess: true,
    returnText: "Back to chat",
    stayInChat: false
  });
});
