import assert from "node:assert/strict";
import test from "node:test";

import { UserFlowStateManager, createFlowStorage } from "@teleforgex/core";

import { handleMiniAppReturn, initiateCoordinatedFlow } from "../dist/index.js";

const secret = "coord-secret";

test("initiateCoordinatedFlow persists state and resolves it from the signed payload", async () => {
  const bot = {
    async sendMessage(chatId, text, options) {
      return {
        chat: {
          id: chatId
        },
        message_id: 17,
        options,
        text
      };
    }
  };
  const storage = new UserFlowStateManager(
    createFlowStorage({
      backend: "memory",
      defaultTTL: 60,
      namespace: "task-shop"
    })
  );

  const result = await initiateCoordinatedFlow(bot, storage, {
    buttonText: "Open Task Shop",
    chatId: 1001,
    flowId: "task-shop-browse",
    initialStep: "catalog",
    payload: {
      source: "start"
    },
    secret,
    text: "Continue in the Mini App",
    userId: "42",
    webAppUrl: "https://example.ngrok.app"
  });

  assert.match(result.stateKey, /^flow:/);

  const buttonUrl = result.message.options?.reply_markup?.inline_keyboard?.[0]?.[0]?.web_app?.url;
  assert.ok(buttonUrl);
  const restored = await handleMiniAppReturn(
    storage,
    new URL(buttonUrl).searchParams.get("tgWebAppStartParam"),
    secret
  );

  assert.equal(restored?.flowId, "task-shop-browse");
  assert.equal(restored?.stepId, "catalog");
  assert.equal(restored?.payload.source, "start");
});
