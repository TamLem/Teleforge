import assert from "node:assert/strict";
import test from "node:test";

import { createSignedPhoneAuthToken } from "../../../core/dist/index.js";
import {
  createPhoneAuthExchangeHandler,
  defineBffRoute,
  executeBffRoute
} from "../../dist/index.js";
import {
  createAuthenticatedTelegramContext,
  createIdentityAdapter,
  createMemorySessionAdapter
} from "../helpers/session.mjs";

test("phone auth exchange returns a session for an existing phone-mapped user", async () => {
  const route = defineBffRoute({
    auth: "required",
    handler: createPhoneAuthExchangeHandler({
      adapter: createMemorySessionAdapter(),
      identity: {
        adapter: createIdentityAdapter({
          async findByPhoneNumber(phoneNumber) {
            return {
              id: "app_user_phone_1",
              phoneNumber
            };
          }
        }),
        autoCreate: false,
        secret: "phone-auth-secret"
      },
      secret: "teleforge-session-secret"
    }),
    method: "POST",
    path: "/phone/exchange"
  });
  const context = await createAuthenticatedTelegramContext("https://example.com/api/phone/exchange");
  const phoneAuthToken = await createSignedPhoneAuthToken(
    {
      phoneNumber: "+1 (202) 555-0199",
      telegramUserId: 279058397
    },
    "phone-auth-secret",
    {
      issuedAt: context.timestamp - 1_000,
      ttlMs: 60_000
    }
  );

  const result = await executeBffRoute(route, context, {
    deviceInfo: {
      platform: "ios"
    },
    phoneAuthToken
  });

  assert.equal(result.identity.appUserId, "app_user_phone_1");
  assert.equal(result.identity.phoneNumber, "+12025550199");
  assert.equal(typeof result.accessToken, "string");
  assert.equal(typeof result.refreshToken, "string");
});

test("phone auth exchange auto-creates when phone lookup misses and autoCreate is enabled", async () => {
  const adapter = createIdentityAdapter({
    async create(user) {
      return {
        id: "created_phone_user",
        ...user
      };
    },
    async findByPhoneNumber() {
      return null;
    }
  });
  const route = defineBffRoute({
    auth: "required",
    handler: createPhoneAuthExchangeHandler({
      adapter: createMemorySessionAdapter(),
      identity: {
        adapter,
        autoCreate: true,
        secret: "phone-auth-secret"
      },
      secret: "teleforge-session-secret"
    }),
    method: "POST",
    path: "/phone/exchange"
  });
  const context = await createAuthenticatedTelegramContext("https://example.com/api/phone/exchange");
  const phoneAuthToken = await createSignedPhoneAuthToken(
    {
      phoneNumber: "+251 91 234 5678",
      telegramUserId: 279058397
    },
    "phone-auth-secret",
    {
      issuedAt: context.timestamp - 1_000,
      ttlMs: 60_000
    }
  );

  const result = await executeBffRoute(route, context, {
    phoneAuthToken
  });

  assert.equal(result.identity.appUserId, "created_phone_user");
  assert.equal(result.identity.phoneNumber, "+251912345678");
  assert.equal(result.identity.appUser?.phoneNumber, "+251912345678");
});

test("phone auth exchange rejects tokens for another Telegram user", async () => {
  const route = defineBffRoute({
    auth: "required",
    handler: createPhoneAuthExchangeHandler({
      adapter: createMemorySessionAdapter(),
      identity: {
        adapter: createIdentityAdapter(),
        autoCreate: false,
        secret: "phone-auth-secret"
      },
      secret: "teleforge-session-secret"
    }),
    method: "POST",
    path: "/phone/exchange"
  });
  const context = await createAuthenticatedTelegramContext("https://example.com/api/phone/exchange");
  const phoneAuthToken = await createSignedPhoneAuthToken(
    {
      phoneNumber: "+12025550199",
      telegramUserId: 1
    },
    "phone-auth-secret",
    {
      issuedAt: context.timestamp - 1_000,
      ttlMs: 60_000
    }
  );

  await assert.rejects(
    () =>
      executeBffRoute(route, context, {
        phoneAuthToken
      }),
    /Phone auth token does not match/
  );
});

test("phone auth exchange rejects expired tokens", async () => {
  const route = defineBffRoute({
    auth: "required",
    handler: createPhoneAuthExchangeHandler({
      adapter: createMemorySessionAdapter(),
      identity: {
        adapter: createIdentityAdapter(),
        autoCreate: false,
        secret: "phone-auth-secret"
      },
      secret: "teleforge-session-secret"
    }),
    method: "POST",
    path: "/phone/exchange"
  });
  const context = await createAuthenticatedTelegramContext("https://example.com/api/phone/exchange");
  const phoneAuthToken = await createSignedPhoneAuthToken(
    {
      phoneNumber: "+12025550199",
      telegramUserId: 279058397
    },
    "phone-auth-secret",
    {
      issuedAt: context.timestamp - 10_000,
      ttlMs: 1_000
    }
  );

  await assert.rejects(
    () =>
      executeBffRoute(route, context, {
        phoneAuthToken
      }),
    /invalid or expired/
  );
});
