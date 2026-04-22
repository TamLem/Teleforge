import assert from "node:assert/strict";
import test from "node:test";

import {
  defineCoordinatedRoute,
  generateMiniAppLink,
  inferStateKeyFromFlowContext,
  validateManifest,
  verifySignedFlowContext
} from "../dist/index.js";

const secret = "coord-secret";

test("defineCoordinatedRoute preserves route metadata for introspection", () => {
  const route = defineCoordinatedRoute({
    coordination: {
      entryPoints: [{ command: "start", type: "bot_command" }],
      flow: {
        entryStep: "catalog",
        flowId: "task-shop-browse",
        requestWriteAccess: true
      },
      returnToChat: {
        stayInChat: true,
        text: "Back to Task Shop chat"
      }
    },
    path: "/catalog",
    title: "Catalog"
  });

  assert.equal(route.path, "/catalog");
  assert.deepEqual(route.coordination.entryPoints, [{ command: "start", type: "bot_command" }]);
  assert.equal(route.coordination.flow?.flowId, "task-shop-browse");
  assert.equal(route.coordination.returnToChat?.stayInChat, true);
});

test("generateMiniAppLink preserves the signed flow-context wire format", () => {
  const link = generateMiniAppLink({
    flowId: "task-shop-browse",
    payload: {
      entry: "start-command"
    },
    requestWriteAccess: true,
    returnText: "Back to Task Shop chat",
    secret,
    stateKey: "flow:test-state",
    stayInChat: true,
    stepId: "catalog",
    webAppUrl: "https://example.ngrok.app/shop?view=home"
  });
  const url = new URL(link);
  const flowContext = url.searchParams.get("tgWebAppStartParam");

  assert.equal(url.searchParams.get("view"), "home");
  assert.equal(url.searchParams.get("tfRequestWriteAccess"), "1");
  assert.equal(url.searchParams.get("tfStayInChat"), "1");
  assert.ok(flowContext?.startsWith("tfp1."));
  assert.deepEqual(verifySignedFlowContext(flowContext, secret), {
    flowId: "task-shop-browse",
    payload: {
      entry: "start-command",
      stateKey: "flow:test-state"
    },
    requestWriteAccess: true,
    returnText: "Back to Task Shop chat",
    stayInChat: true,
    stepId: "catalog"
  });
  assert.equal(inferStateKeyFromFlowContext(flowContext), "flow:test-state");
});

test("validateManifest accepts route coordination metadata", () => {
  const result = validateManifest({
    bot: {
      tokenEnv: "BOT_TOKEN",
      username: "sample_bot",
      webhook: {
        path: "/api/webhook",
        secretEnv: "WEBHOOK_SECRET"
      }
    },
    id: "sample-app",
    miniApp: {
      capabilities: ["write_access"],
      defaultMode: "inline",
      entryPoint: "apps/web/src/main.tsx",
      launchModes: ["inline"]
    },
    name: "Sample App",
    routes: [
      {
        coordination: {
          entryPoints: [{ type: "miniapp" }],
          flow: {
            entryStep: "catalog",
            flowId: "task-shop-browse"
          },
          returnToChat: {
            text: "Back to chat"
          }
        },
        path: "/"
      }
    ],
    runtime: {},
    version: "1.0.0"
  });

  assert.equal(result.success, true);
});
