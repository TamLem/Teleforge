import assert from "node:assert/strict";
import test from "node:test";

import { defineBffRoute } from "../../dist/index.js";

test("defineBffRoute preserves shared coordination metadata", () => {
  const route = defineBffRoute({
    auth: "required",
    coordination: {
      entryPoints: [{ command: "start", type: "bot_command" }],
      flow: {
        entryStep: "catalog",
        flowId: "task-shop-browse"
      },
      returnToChat: {
        stayInChat: true,
        text: "Back to chat"
      }
    },
    handler: () => ({ ok: true }),
    method: "POST",
    path: "/api/checkout"
  });

  assert.deepEqual(route.config.coordination, {
    entryPoints: [{ command: "start", type: "bot_command" }],
    flow: {
      entryStep: "catalog",
      flowId: "task-shop-browse"
    },
    returnToChat: {
      stayInChat: true,
      text: "Back to chat"
    }
  });
});
