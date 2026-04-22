import test from "node:test";
import assert from "node:assert/strict";
import { configureTelegramWebhook } from "../dist/utils/webhook.js";

test("configures the Telegram webhook when manifest and env are present", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (String(url).includes("setWebhook")) {
      return {
        ok: true,
        async json() {
          return { ok: true };
        }
      };
    }

    return {
      ok: true,
      async json() {
        return {
          ok: true,
          result: {
            url: "https://demo.loca.lt/api/webhook"
          }
        };
      }
    };
  };

  const result = await configureTelegramWebhook({
    env: {
      BOT_TOKEN: "123:test",
      WEBHOOK_SECRET: "secret"
    },
    fetchImpl,
    manifest: {
      bot: {
        tokenEnv: "BOT_TOKEN",
        webhook: {
          path: "/api/webhook",
          secretEnv: "WEBHOOK_SECRET"
        }
      },
      runtime: {}
    },
    tunnelUrl: "https://demo.loca.lt"
  });

  assert.equal(result.status, "configured");
  assert.equal(result.webhookUrl, "https://demo.loca.lt/api/webhook");
  assert.equal(calls.length, 2);
});

test("skips webhook configuration when the bot token is missing", async () => {
  const result = await configureTelegramWebhook({
    env: {},
    manifest: {
      bot: {
        tokenEnv: "BOT_TOKEN",
        webhook: {
          path: "/api/webhook"
        }
      },
      runtime: {}
    },
    tunnelUrl: "https://demo.loca.lt"
  });

  assert.equal(result.status, "skipped");
  assert.match(result.message, /BOT_TOKEN/);
});
