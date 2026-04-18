import type { AppUser, IdentityManager, IdentityResolveInput, ResolvedIdentity } from "./types.js";
import type { BffRequestContext } from "../context/types.js";

const DEFAULT_IDENTITY_CACHE_TTL = 1_000;

export function getIdentityCacheKey<TAppUser extends AppUser>(
  context: BffRequestContext,
  options: IdentityManager<TAppUser>,
  input: IdentityResolveInput
): string | null {
  const telegramUser = context.telegramUser;

  if (!telegramUser) {
    return null;
  }

  return `identity:${options.providers.map((provider) => provider.name).join(",")}:${telegramUser.id}:${telegramUser.username ?? "missing"}:${options.autoCreate}:${input.phoneAuthToken ?? ""}`;
}

export function getIdentityCacheTTL<TAppUser extends AppUser>(
  options: IdentityManager<TAppUser>
): number {
  return options.cacheTTL ?? DEFAULT_IDENTITY_CACHE_TTL;
}

export function getCachedIdentity<TAppUser extends AppUser>(
  context: BffRequestContext,
  key: string,
  now: number
): ResolvedIdentity<TAppUser> | null {
  const cached = context._resolutionCache.get(key);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= now) {
    context._resolutionCache.delete(key);
    return null;
  }

  return cached.value as ResolvedIdentity<TAppUser> | null;
}

export function setCachedIdentity<TAppUser extends AppUser>(
  context: BffRequestContext,
  key: string,
  value: ResolvedIdentity<TAppUser> | null,
  ttl: number,
  now: number
) {
  context._resolutionCache.set(key, {
    expiresAt: now + ttl,
    value
  });
}
