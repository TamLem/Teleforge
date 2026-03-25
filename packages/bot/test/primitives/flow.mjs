import assert from "node:assert/strict";
import test from "node:test";

import { extractFlowContext, sendFlowInit, templates } from "../../dist/index.js";

const secret = "coord-secret";

test("sendFlowInit sends a message with a signed flow payload", async () => {
  const sent = [];
  const bot = {
    async sendMessage(chatId, text, options) {
      const message = {
        chat: {
          id: chatId
        },
        message_id: 31,
        options,
        text
      };
      sent.push(message);
      return message;
    }
  };
  const template = templates.continueInMiniApp("task-shop-browse", "Browse tasks and checkout.");

  await sendFlowInit(bot, {
    buttonText: "Open Task Shop",
    chatId: 1001,
    flowId: "task-shop-browse",
    payload: {
      source: "start-command"
    },
    requestWriteAccess: true,
    returnText: "Return to Task Shop chat",
    secret,
    stayInChat: true,
    stepId: "catalog",
    text: template.text,
    webAppUrl: "https://example.ngrok.app"
  });

  assert.equal(sent[0]?.text, template.text);
  const button = sent[0]?.options?.reply_markup?.inline_keyboard?.[0]?.[0];
  assert.ok(button?.web_app?.url);

  const url = new URL(button.web_app.url);
  const signedPayload = url.searchParams.get("tgWebAppStartParam");
  assert.ok(signedPayload);
  assert.deepEqual(extractFlowContext(signedPayload, secret), {
    flowId: "task-shop-browse",
    payload: {
      source: "start-command"
    },
    requestWriteAccess: true,
    returnText: "Return to Task Shop chat",
    stayInChat: true,
    stepId: "catalog"
  });
});

test("coordination templates return sendable message configs", () => {
  const templateSet = [
    templates.continueInMiniApp("task-shop", "Browse the catalogue."),
    templates.returnToChat({
      flowId: "task-shop",
      outcome: "completed",
      summary: "Order confirmed."
    }),
    templates.progressUpdate(2, 3),
    templates.recoveryPrompt("task-shop")
  ];

  for (const template of templateSet) {
    assert.equal(typeof template.text, "string");
    assert.ok(template.text.length > 0);
    assert.equal(template.options === undefined || typeof template.options === "object", true);
  }
});
