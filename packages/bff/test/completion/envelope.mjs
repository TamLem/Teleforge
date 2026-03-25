import assert from "node:assert/strict";
import test from "node:test";

import {
  BffError,
  buildBffResponse,
  buildRouteResponse,
  defineBffRoute,
  validateCompletionAction,
  withCompletion
} from "../../dist/index.js";

test("withCompletion wraps data with a validated completion envelope", () => {
  const response = withCompletion(
    {
      orderId: "ord_1"
    },
    {
      chatId: 42,
      text: "Order confirmed",
      type: "sendMessage"
    }
  );

  assert.deepEqual(response, {
    completion: {
      action: {
        chatId: 42,
        text: "Order confirmed",
        type: "sendMessage"
      },
      version: "1.0"
    },
    data: {
      orderId: "ord_1"
    }
  });
});

test("buildBffResponse omits completion when no action is provided", () => {
  const response = buildBffResponse({
    ok: true
  });

  assert.deepEqual(response, {
    data: {
      ok: true
    }
  });
});

test("buildRouteResponse attaches dynamic completion from route config", () => {
  const route = defineBffRoute({
    auth: "public",
    completion(_context, result) {
      return {
        chatId: result.chatId,
        text: `Order ${result.orderId} confirmed`,
        type: "sendMessage"
      };
    },
    handler() {
      return {
        chatId: 99,
        orderId: "ord_42",
        success: true
      };
    },
    method: "POST",
    path: "/orders/complete"
  });
  const result = {
    chatId: 99,
    orderId: "ord_42",
    success: true
  };
  const response = buildRouteResponse(
    route,
    {
      headers: new Headers(),
      launchMode: "compact",
      method: "POST",
      path: "/orders/complete",
      searchParams: new URLSearchParams(),
      setHeader() {},
      setStatus() {}
    },
    result
  );

  assert.equal(response.data.orderId, "ord_42");
  assert.equal(response.completion?.action.type, "sendMessage");
  assert.equal(response.completion?.action.text, "Order ord_42 confirmed");
});

test("validateCompletionAction rejects invalid completion actions", () => {
  assert.throws(
    () =>
      validateCompletionAction({
        type: "openLink",
        url: "not-a-url"
      }),
    (error) => error instanceof BffError && error.code === "INVALID_COMPLETION_CONFIG"
  );
});

test("defineBffRoute rejects invalid static completion config at definition time", () => {
  assert.throws(
    () =>
      defineBffRoute({
        auth: "public",
        completion: {
          type: "sendMessage"
        },
        handler() {
          return {
            ok: true
          };
        },
        method: "POST",
        path: "/invalid-completion"
      }),
    (error) => error instanceof BffError && error.code === "INVALID_COMPLETION_CONFIG"
  );
});
