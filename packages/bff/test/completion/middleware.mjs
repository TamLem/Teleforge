import assert from "node:assert/strict";
import test from "node:test";

import { defineBffRoute, executeBffRoute, withCompletionHandler } from "../../dist/index.js";

test("withCompletionHandler wraps middleware results in a completion envelope", async () => {
  const route = defineBffRoute({
    auth: "public",
    async handler() {
      return {
        orderId: "ord_7"
      };
    },
    method: "POST",
    middlewares: [
      withCompletionHandler((_context, result) => ({
        chatId: 7,
        text: `Order ${result.orderId} done`,
        type: "sendMessage"
      }))
    ],
    path: "/orders/complete"
  });

  const result = await executeBffRoute(
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
    {}
  );

  assert.deepEqual(result, {
    completion: {
      action: {
        chatId: 7,
        text: "Order ord_7 done",
        type: "sendMessage"
      },
      version: "1.0"
    },
    data: {
      orderId: "ord_7"
    }
  });
});
