import assert from "node:assert/strict";
import test from "node:test";

import { createSessionRoutes, executeBffRoute } from "../../dist/index.js";
import {
  createAuthenticatedTelegramContext,
  createIdentityAdapter,
  createMemorySessionAdapter,
  createSessionRequestContext
} from "../helpers/session.mjs";

test("session revoke invalidates the current session", async () => {
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

  const revoked = await executeBffRoute(routes.revoke, revokeContext, {});

  assert.equal(revoked.revoked, true);
  assert.equal(typeof revoked.sessionId, "string");
  assert.equal(adapter.sessions.get(revoked.sessionId)?.revokedAt !== null, true);
});
