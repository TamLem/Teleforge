import assert from "node:assert/strict";
import test from "node:test";

import {
  BffSessionError,
  createAccessToken,
  createSessionRoutes,
  executeBffRoute,
  hashRefreshToken,
  telegramIdIdentityProvider,
  verifyAccessToken
} from "../../dist/index.js";
import {
  createAuthenticatedTelegramContext,
  createIdentityAdapter,
  createMemorySessionAdapter
} from "../helpers/session.mjs";

test("session refresh rotates the refresh token and returns a new access token pair", async () => {
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
  const exchange = await executeBffRoute(routes.exchange, context, {});

  const refreshed = await executeBffRoute(routes.refresh, context, {
    refreshToken: exchange.refreshToken
  });
  const record = adapter.sessions.values().next().value;
  const previousHash = await hashRefreshToken(exchange.refreshToken);
  const nextHash = await hashRefreshToken(refreshed.refreshToken);

  assert.notEqual(refreshed.refreshToken, exchange.refreshToken);
  assert.equal(refreshed.identity.appUserId, "app_user_1");
  assert.equal(adapter.sessions.size, 1);
  assert.equal(record.refreshTokens[previousHash].usedAt !== null, true);
  assert.equal(record.refreshTokens[previousHash].replacedBy, nextHash);
  assert.equal(record.refreshTokens[nextHash].sequence, 1);
});

test("verifyAccessToken surfaces TOKEN_EXPIRED for expired access tokens", async () => {
  const { token } = await createAccessToken(
    {
      sid: "session-1",
      sub: "app_user_1",
      tid: 279058397
    },
    "teleforge-session-secret",
    -1
  );

  await assert.rejects(
    () => verifyAccessToken(token, "teleforge-session-secret"),
    (error) => error instanceof BffSessionError && error.code === "TOKEN_EXPIRED"
  );
});
