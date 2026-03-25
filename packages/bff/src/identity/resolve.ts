import {
  getCachedIdentity,
  getIdentityCacheKey,
  getIdentityCacheTTL,
  setCachedIdentity
} from "./cache.js";
import { BffIdentityError } from "./errors.js";
import { resolveByTelegramId } from "./strategies/telegramId.js";
import { resolveByUsername } from "./strategies/username.js";

import type { AppUser, IdentityResolutionOptions, ResolvedIdentity } from "./types.js";
import type { BffRequestContext } from "../context/types.js";

export async function resolveIdentity<TAppUser extends AppUser = AppUser>(
  context: BffRequestContext,
  options: IdentityResolutionOptions<TAppUser>
): Promise<ResolvedIdentity<TAppUser> | null> {
  if (context._identityState.promise) {
    return (await context._identityState.promise) as ResolvedIdentity<TAppUser> | null;
  }

  const promise = resolveIdentityInternal(context, options);
  context._identityState.promise = promise as Promise<ResolvedIdentity | null>;

  try {
    const resolvedIdentity = await promise;
    context._identityState.value = resolvedIdentity as ResolvedIdentity | null;
    return resolvedIdentity;
  } finally {
    context._identityState.promise = null;
  }
}

async function resolveIdentityInternal<TAppUser extends AppUser>(
  context: BffRequestContext,
  options: IdentityResolutionOptions<TAppUser>
): Promise<ResolvedIdentity<TAppUser> | null> {
  const telegramUser = context.telegramUser;

  if (!telegramUser) {
    return null;
  }

  const now = Date.now();
  const cacheKey = getIdentityCacheKey(context, options);

  if (cacheKey) {
    const cached = getCachedIdentity(context, cacheKey, now);

    if (cached !== null) {
      context._identityState.value = cached as ResolvedIdentity | null;
      return cached as ResolvedIdentity<TAppUser> | null;
    }
  }

  try {
    let appUser: TAppUser | null;

    switch (options.strategy) {
      case "telegram-id":
        appUser = await resolveByTelegramId(options.adapter, telegramUser.id);
        break;
      case "username":
        appUser = await resolveByUsername(options.adapter, telegramUser.username);
        break;
      case "custom":
        if (!options.resolve) {
          throw new BffIdentityError(
            "IDENTITY_STRATEGY_INVALID",
            500,
            "Custom identity resolution requires an injected resolve() function."
          );
        }

        appUser = await options.resolve({
          adapter: options.adapter,
          context,
          telegramUser
        });
        break;
      default:
        throw new BffIdentityError(
          "IDENTITY_STRATEGY_INVALID",
          500,
          `Unsupported identity strategy: ${String(options.strategy)}`
        );
    }

    let isNewUser = false;

    if (!appUser && options.autoCreate) {
      const createInput = {
        ...(await options.onCreate?.(telegramUser, context)),
        telegramFirstName: telegramUser.first_name,
        telegramLanguageCode: telegramUser.language_code ?? null,
        telegramLastName: telegramUser.last_name ?? null,
        telegramUserId: telegramUser.id,
        telegramUsername: telegramUser.username ?? null
      } as unknown as Partial<TAppUser>;

      appUser = await options.adapter.create(createInput);
      isNewUser = true;
    }

    const resolvedIdentity = createResolvedIdentity(appUser, isNewUser, telegramUser, now);

    if (cacheKey) {
      setCachedIdentity(context, cacheKey, resolvedIdentity, getIdentityCacheTTL(options), now);
    }

    return resolvedIdentity;
  } catch (error) {
    if (error instanceof BffIdentityError) {
      throw error;
    }

    throw new BffIdentityError(
      "IDENTITY_RESOLUTION_FAILED",
      500,
      error instanceof Error ? error.message : "Identity resolution failed."
    );
  }
}

function createResolvedIdentity<TAppUser extends AppUser>(
  appUser: TAppUser | null,
  isNewUser: boolean,
  telegramUser: NonNullable<BffRequestContext["telegramUser"]>,
  resolvedAt: number
): ResolvedIdentity<TAppUser> {
  return {
    appUser,
    appUserId: appUser?.id ?? null,
    isNewUser,
    resolvedAt,
    telegramUserId: telegramUser.id,
    ...(telegramUser.username ? { telegramUsername: telegramUser.username } : {})
  };
}
