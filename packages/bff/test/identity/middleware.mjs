import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import {
  createBffRequestContext,
  defineBffRoute,
  executeBffRoute,
  telegramIdIdentityProvider,
  withIdentityResolution
} from "../../dist/index.js";

test("withIdentityResolution populates ctx.identity before the route handler executes", async () => {
  const vector = createEd25519SampleVector();
  const context = await createBffRequestContext(
    new Request("https://example.com/api/me", {
      headers: {
        "x-telegram-init-data": vector.initData
      }
    }),
    {
      botId: vector.botId,
      publicKey: vector.publicKeyHex,
      validateInitData: true
    }
  );

  let adapterCalls = 0;
  const route = defineBffRoute({
    auth: "required",
    async handler(routeContext) {
      return {
        appUserId: routeContext.identity?.appUserId ?? null,
        telegramUserId: routeContext.identity?.telegramUserId ?? null
      };
    },
    method: "GET",
    middlewares: [
      withIdentityResolution({
        adapter: {
          async create(user) {
            return {
              id: "user_created",
              ...user
            };
          },
          async findByTelegramId(telegramUserId) {
            adapterCalls += 1;

            return {
              id: "user_resolved",
              telegramUserId
            };
          },
          async findByUsername() {
            return null;
          },
          async update(appUserId, updates) {
            return {
              id: appUserId,
              ...updates
            };
          }
        },
        autoCreate: false,
        providers: [telegramIdIdentityProvider()]
      })
    ],
    path: "/me"
  });

  const result = await executeBffRoute(route, context, undefined);

  assert.deepEqual(result, {
    appUserId: "user_resolved",
    telegramUserId: 279058397
  });
  assert.equal(adapterCalls, 1);
  assert.equal(context.identity?.appUserId, "user_resolved");
});

function createEd25519SampleVector() {
  const authDate = Math.floor(Date.now() / 1000);
  const botId = 12_345_678;
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const params = new URLSearchParams();

  params.set("auth_date", String(authDate));
  params.set("query_id", "AAHdF6IQAAAAAN0XohDhrOrc");
  params.set(
    "user",
    JSON.stringify({
      first_name: "Integration",
      id: 279058397,
      username: "integration_user"
    })
  );

  const dataCheckString = [
    `${botId}:WebAppData`,
    ...[...params.entries()].map(([key, value]) => `${key}=${value}`).sort()
  ].join("\n");
  const signature = sign(null, Buffer.from(dataCheckString), privateKey)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  params.set("signature", signature);

  const publicKeyDer = publicKey.export({
    format: "der",
    type: "spki"
  });

  return {
    botId,
    initData: params.toString(),
    publicKeyHex: publicKeyDer.subarray(12).toString("hex")
  };
}
