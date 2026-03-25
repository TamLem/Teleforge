import assert from "node:assert/strict";
import test from "node:test";

import {
  BffRouteError,
  BffSessionError,
  createSessionRoutes,
  defineBffRoute,
  executeBffRoute,
  withSessionValidation
} from "../../dist/index.js";
import {
  createAuthenticatedTelegramContext,
  createIdentityAdapter,
  createMemorySessionAdapter,
  createSessionRequestContext
} from "../helpers/session.mjs";

test("withSessionValidation hydrates session auth and identity from a bearer token", async () => {
  const adapter = createMemorySessionAdapter();
  const routes = createSessionRoutes({
    adapter,
    identity: {
      adapter: createIdentityAdapter(),
      autoCreate: false,
      strategy: "telegram-id"
    },
    secret: "teleforge-session-secret"
  });
  const exchangeContext = await createAuthenticatedTelegramContext();
  const exchange = await executeBffRoute(routes.exchange, exchangeContext, {});
  const sessionContext = await createSessionRequestContext(exchange.accessToken);
  const route = defineBffRoute({
    auth: "public",
    async handler(context) {
      return {
        authType: context.auth.type,
        identity: context.identity,
        sessionId: context.auth.sessionId
      };
    },
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

  const result = await executeBffRoute(route, sessionContext, {});

  assert.equal(result.authType, "session");
  assert.equal(typeof result.sessionId, "string");
  assert.equal(result.identity?.appUserId, "app_user_1");
  assert.equal(result.identity?.telegramUserId, 279058397);
});

test("withSessionValidation rejects missing required tokens with UNAUTHENTICATED", async () => {
  const adapter = createMemorySessionAdapter();
  const context = await createSessionRequestContext(null);
  const route = defineBffRoute({
    auth: "public",
    async handler() {
      return { ok: true };
    },
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

  await assert.rejects(
    () => executeBffRoute(route, context, {}),
    (error) => error instanceof BffRouteError && error.code === "UNAUTHENTICATED"
  );
});

test("withSessionValidation rejects revoked sessions", async () => {
  const adapter = createMemorySessionAdapter();
  const routes = createSessionRoutes({
    adapter,
    identity: {
      adapter: createIdentityAdapter(),
      autoCreate: false,
      strategy: "telegram-id"
    },
    secret: "teleforge-session-secret"
  });
  const exchangeContext = await createAuthenticatedTelegramContext();
  const exchange = await executeBffRoute(routes.exchange, exchangeContext, {});
  const revokeContext = await createSessionRequestContext(exchange.accessToken);

  await executeBffRoute(routes.revoke, revokeContext, {});

  const protectedContext = await createSessionRequestContext(exchange.accessToken);
  const route = defineBffRoute({
    auth: "public",
    async handler() {
      return { ok: true };
    },
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

  await assert.rejects(
    () => executeBffRoute(route, protectedContext, {}),
    (error) => error instanceof BffSessionError && error.code === "SESSION_REVOKED"
  );
});
