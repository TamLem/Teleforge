import assert from "node:assert/strict";
import test from "node:test";

import {
  BffSessionError,
  SessionSecurityEventTypes,
  createSessionRoutes,
  defineBffRoute,
  executeBffRoute,
  telegramIdIdentityProvider,
  withSessionValidation
} from "../../dist/index.js";
import {
  createAuthenticatedTelegramContext,
  createIdentityAdapter,
  createMemorySessionAdapter,
  createSessionRequestContext
} from "../helpers/session.mjs";

test("refresh token reuse revokes the family and emits a security event", async () => {
  const adapter = createMemorySessionAdapter();
  const events = [];
  const routes = createSessionRoutes({
    adapter,
    identity: {
      adapter: createIdentityAdapter(),
      autoCreate: false,
      providers: [telegramIdIdentityProvider()]
    },
    secret: "teleforge-session-secret",
    securityEvents: {
      emit(event) {
        events.push(event);
      }
    }
  });
  const context = await createAuthenticatedTelegramContext();
  const exchange = await executeBffRoute(routes.exchange, context, {});

  await executeBffRoute(routes.refresh, context, {
    refreshToken: exchange.refreshToken
  });

  await assert.rejects(
    () =>
      executeBffRoute(routes.refresh, context, {
        refreshToken: exchange.refreshToken
      }),
    (error) => error instanceof BffSessionError && error.code === "REFRESH_TOKEN_REUSED"
  );

  const session = adapter.sessions.values().next().value;

  assert.equal(session.revokedAt !== null, true);
  assert.equal(session.compromisedAt !== null, true);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, SessionSecurityEventTypes.REFRESH_TOKEN_REUSE_DETECTED);
  assert.equal(events[0].payload.familyId, session.refreshTokenFamilyId);
  assert.equal(events[0].payload.sessionId, session.id);
  assert.equal(events[0].payload.userId, session.userId);
});

test("parallel refresh attempts trigger reuse detection for the losing request", async () => {
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
  const refreshInput = {
    refreshToken: exchange.refreshToken
  };
  const [first, second] = await Promise.allSettled([
    executeBffRoute(routes.refresh, context, refreshInput),
    executeBffRoute(routes.refresh, context, refreshInput)
  ]);
  const outcomes = [first, second];
  const successCount = outcomes.filter((result) => result.status === "fulfilled").length;
  const reuseCount = outcomes.filter(
    (result) =>
      result.status === "rejected" &&
      result.reason instanceof BffSessionError &&
      result.reason.code === "REFRESH_TOKEN_REUSED"
  ).length;

  assert.equal(successCount, 1);
  assert.equal(reuseCount, 1);
  assert.equal(adapter.sessions.values().next().value.revokedAt !== null, true);
});

test("revoke-on-reuse invalidates access tokens from the same session family", async () => {
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
  const protectedRoute = defineBffRoute({
    auth: "public",
    handler: (context) => ({
      authType: context.auth.type,
      ok: true
    }),
    method: "POST",
    middlewares: [
      withSessionValidation({
        adapter,
        required: true,
        secret: "teleforge-session-secret"
      })
    ],
    path: "/protected"
  });
  const context = await createAuthenticatedTelegramContext();
  const exchange = await executeBffRoute(routes.exchange, context, {});
  const refreshed = await executeBffRoute(routes.refresh, context, {
    refreshToken: exchange.refreshToken
  });

  await assert.rejects(
    () =>
      executeBffRoute(routes.refresh, context, {
        refreshToken: exchange.refreshToken
      }),
    (error) => error instanceof BffSessionError && error.code === "REFRESH_TOKEN_REUSED"
  );

  const protectedContext = await createSessionRequestContext(refreshed.accessToken);

  await assert.rejects(
    () => executeBffRoute(protectedRoute, protectedContext, {}),
    (error) => error instanceof BffSessionError && error.code === "SESSION_REVOKED"
  );
});
