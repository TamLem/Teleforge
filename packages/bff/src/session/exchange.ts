import { resolveIdentity } from "../identity/resolve.js";
import { BffRouteError } from "../route/errors.js";

import {
  createAccessToken,
  createRefreshToken,
  getAccessTokenTtlSeconds,
  getRefreshTokenTtlSeconds,
  hashRefreshToken
} from "./token.js";

import type { ExchangeInput, ExchangeOutput, SessionRouteOptions } from "./types.js";
import type { AppUser } from "../identity/types.js";
import type { BffHandler } from "../route/types.js";

export function createSessionExchangeHandler<TAppUser extends AppUser = AppUser>(
  options: SessionRouteOptions<TAppUser>
): BffHandler<ExchangeInput, ExchangeOutput<TAppUser>> {
  return async (context, input) => {
    const identity =
      (context.identity as ExchangeOutput<TAppUser>["identity"] | null) ??
      (await resolveIdentity<TAppUser>(context, options.identity));

    if (!identity?.appUserId) {
      context.setStatus(401);
      throw new BffRouteError(
        "UNAUTHENTICATED",
        401,
        "Session exchange requires a resolved application identity."
      );
    }

    const sessionId = createSessionId();
    const accessTokenTtlSeconds = getAccessTokenTtlSeconds(options.accessTokenTtlSeconds);
    const refreshTokenTtlSeconds = getRefreshTokenTtlSeconds(options.refreshTokenTtlSeconds);
    const refreshTokenSecret = await createRefreshToken();
    const refreshToken = `${sessionId}.${refreshTokenSecret}`;
    const refreshTokenHash = await hashRefreshToken(refreshToken);
    const refreshTokenExpiresAt = Date.now() + refreshTokenTtlSeconds * 1000;

    await options.adapter.createSession({
      deviceInfo: input?.deviceInfo,
      id: sessionId,
      refreshTokenExpiresAt,
      refreshTokenHash,
      telegramUserId: identity.telegramUserId,
      userId: identity.appUserId
    });

    const { token: accessToken } = await createAccessToken(
      {
        sid: sessionId,
        sub: identity.appUserId,
        tid: identity.telegramUserId
      },
      options.secret,
      accessTokenTtlSeconds
    );

    return {
      accessToken,
      expiresIn: accessTokenTtlSeconds,
      identity,
      refreshToken
    };
  };
}

function createSessionId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
