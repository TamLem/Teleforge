import { emitRefreshTokenReuseDetected } from "../events/security.js";

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
    const rotatedAt = Date.now();
    const currentRefreshToken = input?.refreshToken ?? "";
    const [sessionId] = currentRefreshToken.split(".", 1);

    if (!sessionId) {
      throw new BffSessionError("REFRESH_TOKEN_INVALID", 401, "Refresh token is malformed.");
    }

    const session = await options.adapter.getSession(sessionId);

    if (!session || session.revokedAt !== null) {
      throw new BffSessionError("SESSION_REVOKED", 401, "The session has been revoked.");
    }

    const currentRefreshTokenHash = await hashRefreshToken(currentRefreshToken);
    const storedToken = session.refreshTokens[currentRefreshTokenHash];

    if (!storedToken) {
      throw new BffSessionError("REFRESH_TOKEN_INVALID", 401, "Refresh token is invalid.");
    }

    if (storedToken.expiresAt <= rotatedAt) {
      throw new BffSessionError("REFRESH_TOKEN_INVALID", 401, "Refresh token has expired.");
    }

    await verifyRefreshToken(currentRefreshToken, storedToken.hash);

    const refreshTokenSecret = await createRefreshToken();
    const refreshToken = `${session.id}.${refreshTokenSecret}`;
    const refreshTokenExpiresAt =
      rotatedAt + getRefreshTokenTtlSeconds(options.refreshTokenTtlSeconds) * 1000;
    const refreshTokenHash = await hashRefreshToken(refreshToken);
    const rotation = await options.adapter.rotateRefreshToken(session.id, {
      currentRefreshTokenHash,
      nextRefreshTokenExpiresAt: refreshTokenExpiresAt,
      nextRefreshTokenHash: refreshTokenHash,
      rotatedAt
    });

    if (rotation.status === "invalid") {
      throw new BffSessionError("REFRESH_TOKEN_INVALID", 401, "Refresh token is invalid.");
    }

    if (rotation.status === "reused") {
      await options.adapter.revokeTokenFamily(rotation.familyId);
      await emitRefreshTokenReuseDetected(options.securityEvents, {
        attemptedAt: rotation.detectedAt,
        familyId: rotation.familyId,
        sessionId: rotation.session.id,
        tokenSequence: rotation.token.sequence,
        userId: rotation.session.userId
      });
      throw new BffSessionError(
        "REFRESH_TOKEN_REUSED",
        401,
        "Refresh token reuse detected; the session has been revoked."
      );
    }

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
        appUserId: rotation.session.userId,
        isNewUser: false,
        resolvedAt: rotatedAt,
        telegramUserId: rotation.session.telegramUserId
      },
      refreshToken
    };
  };
}
