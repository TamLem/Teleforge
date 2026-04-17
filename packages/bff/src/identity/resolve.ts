import { createIdentityManager } from "./manager.js";
import {
  getCachedIdentity,
  getIdentityCacheKey,
  getIdentityCacheTTL,
  setCachedIdentity
} from "./cache.js";
import { BffIdentityError } from "./errors.js";

import type {
  AppUser,
  IdentityManager,
  IdentityProviderResult,
  IdentityResolutionOptions,
  IdentityResolveInput,
  ResolvedIdentity
} from "./types.js";
import type { BffRequestContext } from "../context/types.js";

export async function resolveIdentity<TAppUser extends AppUser = AppUser>(
  context: BffRequestContext,
  options: IdentityManager<TAppUser> | IdentityResolutionOptions<TAppUser>,
  input: IdentityResolveInput = {}
): Promise<ResolvedIdentity<TAppUser> | null> {
  const manager = createIdentityManager(options);
  const identityKey = getIdentityStateKey(context, manager, input);
  const activePromise = context._identityState.promises.get(identityKey);

  if (activePromise) {
    return (await activePromise) as ResolvedIdentity<TAppUser> | null;
  }

  const promise = resolveIdentityInternal(context, manager, input);
  context._identityState.promises.set(identityKey, promise as Promise<ResolvedIdentity | null>);

  try {
    const resolvedIdentity = await promise;
    context._identityState.value = resolvedIdentity as ResolvedIdentity | null;
    context._identityState.valueKey = identityKey;
    return resolvedIdentity;
  } finally {
    context._identityState.promises.delete(identityKey);
  }
}

async function resolveIdentityInternal<TAppUser extends AppUser>(
  context: BffRequestContext,
  options: IdentityManager<TAppUser>,
  input: IdentityResolveInput
): Promise<ResolvedIdentity<TAppUser> | null> {
  const telegramUser = context.telegramUser;

  if (!telegramUser) {
    return null;
  }

  const now = Date.now();
  const cacheKey = getIdentityCacheKey(context, options, input);

  if (cacheKey) {
    const cached = getCachedIdentity(context, cacheKey, now);

    if (cached !== null) {
      context._identityState.value = cached as ResolvedIdentity | null;
      context._identityState.valueKey = cacheKey;
      return cached as ResolvedIdentity<TAppUser> | null;
    }
  }

  try {
    let appUser: TAppUser | null = null;
    let matchedProvider: IdentityProviderResult<TAppUser> | null = null;

    for (const provider of options.providers) {
      const result = await provider.resolve({
        adapter: options.adapter,
        context,
        input,
        telegramUser
      });

      if (!result) {
        continue;
      }

      matchedProvider ??= result;

      if (result.appUser) {
        appUser = result.appUser;
        matchedProvider = result;
        break;
      }
    }

    let isNewUser = false;

    if (!appUser && options.autoCreate && matchedProvider) {
      const createInput = {
        ...(await options.onCreate?.(telegramUser, context)),
        ...(matchedProvider.createInput ?? {}),
        telegramFirstName: telegramUser.first_name,
        telegramLanguageCode: telegramUser.language_code ?? null,
        telegramLastName: telegramUser.last_name ?? null,
        telegramUserId: telegramUser.id,
        telegramUsername: telegramUser.username ?? null
      } as unknown as Partial<TAppUser>;

      appUser = await options.adapter.create(createInput);
      isNewUser = true;
    }

    const resolvedIdentity = createResolvedIdentity(
      appUser,
      isNewUser,
      telegramUser,
      now,
      matchedProvider?.phoneNumber
    );

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
  resolvedAt: number,
  phoneNumber?: string
): ResolvedIdentity<TAppUser> {
  return {
    appUser,
    appUserId: appUser?.id ?? null,
    isNewUser,
    ...(phoneNumber ? { phoneNumber } : {}),
    resolvedAt,
    telegramUserId: telegramUser.id,
    ...(telegramUser.username ? { telegramUsername: telegramUser.username } : {})
  };
}

function getIdentityStateKey<TAppUser extends AppUser>(
  context: BffRequestContext,
  options: IdentityManager<TAppUser>,
  input: IdentityResolveInput
): string {
  return (
    getIdentityCacheKey(context, options, input) ??
    `identity:${options.providers.map((provider) => provider.name).join(",")}:none`
  );
}
