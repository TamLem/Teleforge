import { resolvePhoneAuthIdentity } from "../identity/phone.js";
import { resolveIdentity } from "../identity/resolve.js";
import { BffRouteError } from "../route/errors.js";

import {
  createAccessToken,
  createRefreshToken,
  getAccessTokenTtlSeconds,
  getRefreshTokenTtlSeconds,
  hashRefreshToken
} from "./token.js";

import type {
  ExchangeInput,
  ExchangeOutput,
  PhoneAuthExchangeInput,
  PhoneAuthRouteOptions,
  SessionRouteOptions
} from "./types.js";
import type { AppUser, ResolvedIdentity } from "../identity/types.js";
import type { BffRequestContext } from "../context/types.js";
import type { BffHandler } from "../route/types.js";

export function createSessionExchangeHandler<TAppUser extends AppUser = AppUser>(
  options: SessionRouteOptions<TAppUser>
): BffHandler<ExchangeInput, ExchangeOutput<TAppUser>> {
  return async (context, input) => {
    const identity =
      (context.identity as ExchangeOutput<TAppUser>["identity"] | null) ??
      (await resolveIdentity<TAppUser>(context, options.identity));

    if (!identity?.appUserId) {
      throwUnauthenticatedExchange(context);
    }

    return await issueSessionExchange(identity, input, options);
  };
}

export function createPhoneAuthExchangeHandler<TAppUser extends AppUser = AppUser>(
  options: PhoneAuthRouteOptions<TAppUser>
): BffHandler<PhoneAuthExchangeInput, ExchangeOutput<TAppUser>> {
  return async (context, input) => {
    const identity = await resolvePhoneAuthIdentity(context, input?.phoneAuthToken ?? "", options.identity);

    if (!identity?.appUserId) {
      throwUnauthenticatedExchange(context);
    }

    return await issueSessionExchange(identity, input, options);
  };
}

function createSessionId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function issueSessionExchange<TAppUser extends AppUser = AppUser>(
  identity: ResolvedIdentity<TAppUser>,
  input: ExchangeInput | PhoneAuthExchangeInput | undefined,
  options: Pick<
    SessionRouteOptions<TAppUser>,
    "accessTokenTtlSeconds" | "adapter" | "refreshTokenTtlSeconds" | "secret"
  >
): Promise<ExchangeOutput<TAppUser>> {
  const sessionId = createSessionId();
  const accessTokenTtlSeconds = getAccessTokenTtlSeconds(options.accessTokenTtlSeconds);
  const refreshTokenTtlSeconds = getRefreshTokenTtlSeconds(options.refreshTokenTtlSeconds);
  const issuedAt = Date.now();
  const refreshTokenSecret = await createRefreshToken();
  const refreshToken = `${sessionId}.${refreshTokenSecret}`;
  const refreshTokenHash = await hashRefreshToken(refreshToken);
  const refreshTokenExpiresAt = issuedAt + refreshTokenTtlSeconds * 1000;

  await options.adapter.createSession({
    deviceInfo: input?.deviceInfo,
    id: sessionId,
    refreshTokenFamilyId: sessionId,
    refreshTokenExpiresAt,
    refreshTokenHash,
    refreshTokenIssuedAt: issuedAt,
    telegramUserId: identity.telegramUserId,
    userId: identity.appUserId as string
  });

  const { token: accessToken } = await createAccessToken(
    {
      sid: sessionId,
      sub: identity.appUserId as string,
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
}

function throwUnauthenticatedExchange(context: BffRequestContext): never {
  context.setStatus(401);
  throw new BffRouteError(
    "UNAUTHENTICATED",
    401,
    "Session exchange requires a resolved application identity."
  );
}
