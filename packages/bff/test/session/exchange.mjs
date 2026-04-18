import assert from "node:assert/strict";
import test from "node:test";

import {
  executeBffRoute,
  telegramIdIdentityProvider,
  verifyAccessToken
} from "../../dist/index.js";
import { createSessionRoutes } from "../../dist/routes.js";
import {
  createAuthenticatedTelegramContext,
  createIdentityAdapter,
  createMemorySessionAdapter
} from "../helpers/session.mjs";

test("session exchange returns access and refresh tokens with resolved identity", async () => {
  const adapter = createMemorySessionAdapter();
  const routes = createSessionRoutes({
    adapter,
    identity: {
      adapter: createIdentityAdapter(),
      autoCreate: false,
      providers: [telegramIdIdentityProvider()]
    },
    secret: "teleforge-session-secret"
  });
  const context = await createAuthenticatedTelegramContext();

  const result = await executeBffRoute(routes.exchange, context, {
    deviceInfo: {
      platform: "ios",
      version: "1.0.0"
    }
  });
  const claims = await verifyAccessToken(result.accessToken, "teleforge-session-secret");

  assert.equal(result.identity.appUserId, "app_user_1");
  assert.equal(result.identity.telegramUserId, 279058397);
  assert.equal(typeof result.refreshToken, "string");
  assert.equal(claims.sub, "app_user_1");
  assert.equal(claims.tid, 279058397);
  assert.equal(adapter.sessions.size, 1);
});
