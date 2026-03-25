import { BffRouteError } from "../route/errors.js";

import { BffSessionError } from "./errors.js";
import { verifyAccessToken } from "./token.js";

import type { ResolvedIdentity } from "../identity/types.js";
import type { SessionClaims, SessionValidationOptions } from "./types.js";
import type { BffRequestContext } from "../context/types.js";

export async function validateSession(
  context: BffRequestContext,
  options: SessionValidationOptions
): Promise<SessionClaims | null> {
  const accessToken = getBearerToken(context.header("authorization"));

  if (!accessToken) {
    if (!options.required) {
      return null;
    }

    context.setStatus(401);
    throw new BffRouteError(
      "UNAUTHENTICATED",
      401,
      "A session access token is required for this route."
    );
  }

  const claims = await verifyAccessToken(accessToken, options.secret);
  const session = await options.adapter.getSession(claims.sid);

  if (!session || session.revokedAt !== null) {
    context.setStatus(401);
    throw new BffSessionError("SESSION_REVOKED", 401, "The session has been revoked.");
  }

  if (session.userId !== claims.sub || session.telegramUserId !== claims.tid) {
    context.setStatus(401);
    throw new BffSessionError("TOKEN_INVALID", 401, "Session token claims do not match storage.");
  }

  hydrateSessionContext(context, claims);

  return claims;
}

export function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(/\s+/, 2);

  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return token;
}

export function hydrateSessionContext(
  context: BffRequestContext,
  claims: SessionClaims
): ResolvedIdentity {
  context._authState.sessionId = claims.sid;
  context._authState.type = "session";
  context._identityState.value = {
    appUser: null,
    appUserId: claims.sub,
    isNewUser: false,
    resolvedAt: claims.iat * 1000,
    telegramUserId: claims.tid
  };

  return context._identityState.value;
}
