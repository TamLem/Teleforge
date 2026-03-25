import { withIdentityResolution } from "../identity/middleware.js";
import { defineBffRoute } from "../route/defineBffRoute.js";
import { createSessionExchangeHandler } from "../session/exchange.js";
import { withSessionValidation } from "../session/middleware.js";
import { createSessionRefreshHandler } from "../session/refresh.js";
import { createSessionRevokeHandler } from "../session/revoke.js";

import type { AppUser } from "../identity/types.js";
import type { SessionRouteOptions } from "../session/types.js";

export function createSessionRoutes<TAppUser extends AppUser = AppUser>(
  options: SessionRouteOptions<TAppUser>
) {
  return {
    exchange: defineBffRoute({
      auth: "required",
      handler: createSessionExchangeHandler(options),
      method: "POST",
      middlewares: [withIdentityResolution(options.identity)],
      path: "/exchange"
    }),
    refresh: defineBffRoute({
      auth: "public",
      handler: createSessionRefreshHandler(options),
      method: "POST",
      path: "/refresh"
    }),
    revoke: defineBffRoute({
      auth: "public",
      handler: createSessionRevokeHandler(options),
      method: "POST",
      middlewares: [
        withSessionValidation({
          adapter: options.adapter,
          required: true,
          secret: options.secret
        })
      ],
      path: "/revoke"
    })
  };
}
