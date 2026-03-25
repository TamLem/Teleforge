import { BffSessionError } from "./errors.js";
import {
  createAccessToken,
  createRefreshToken,
  getAccessTokenTtlSeconds,
  getRefreshTokenTtlSeconds,
  hashRefreshToken,
  verifyRefreshToken
} from "./token.js";

import type { ExchangeOutput, RefreshInput, SessionConfig } from "./types.js";
import type { BffHandler } from "../route/types.js";

export function createSessionRefreshHandler(
  options: SessionConfig
): BffHandler<RefreshInput, ExchangeOutput> {
  return async (_context, input) => {
    const currentRefreshToken = input?.refreshToken ?? "";
    const [sessionId] = currentRefreshToken.split(".", 1);

    if (!sessionId) {
      throw new BffSessionError("REFRESH_TOKEN_INVALID", 401, "Refresh token is malformed.");
    }

    const session = await options.adapter.getSession(sessionId);

    if (!session || session.revokedAt !== null) {
      throw new BffSessionError("SESSION_REVOKED", 401, "The session has been revoked.");
    }

    if (session.refreshTokenExpiresAt <= Date.now()) {
      throw new BffSessionError("REFRESH_TOKEN_INVALID", 401, "Refresh token has expired.");
    }

    await verifyRefreshToken(currentRefreshToken, session.refreshTokenHash);

    const refreshTokenSecret = await createRefreshToken();
    const refreshToken = `${session.id}.${refreshTokenSecret}`;
    const refreshTokenExpiresAt =
      Date.now() + getRefreshTokenTtlSeconds(options.refreshTokenTtlSeconds) * 1000;
    const refreshTokenHash = await hashRefreshToken(refreshToken);

    await options.adapter.rotateRefreshToken(session.id, refreshTokenHash, refreshTokenExpiresAt);

    const accessTokenTtlSeconds = getAccessTokenTtlSeconds(options.accessTokenTtlSeconds);
    const { token: accessToken } = await createAccessToken(
      {
        sid: session.id,
        sub: session.userId,
        tid: session.telegramUserId
      },
      options.secret,
      accessTokenTtlSeconds
    );

    return {
      accessToken,
      expiresIn: accessTokenTtlSeconds,
      identity: {
        appUser: null,
        appUserId: session.userId,
        isNewUser: false,
        resolvedAt: Date.now(),
        telegramUserId: session.telegramUserId
      },
      refreshToken
    };
  };
}
