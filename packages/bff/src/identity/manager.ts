import { BffIdentityError } from "./errors.js";

import type { AppUser, IdentityManager, IdentityResolutionOptions } from "./types.js";

export function createIdentityManager<TAppUser extends AppUser = AppUser>(
  options: IdentityManager<TAppUser> | IdentityResolutionOptions<TAppUser>
): IdentityManager<TAppUser> {
  return normalizeIdentityManager({
    adapter: options.adapter,
    autoCreate: options.autoCreate,
    ...(options.cacheTTL !== undefined ? { cacheTTL: options.cacheTTL } : {}),
    ...(options.onCreate ? { onCreate: options.onCreate } : {}),
    providers: [...options.providers]
  });
}

function normalizeIdentityManager<TAppUser extends AppUser>(
  options: IdentityManager<TAppUser>
): IdentityManager<TAppUser> {
  if (!Array.isArray(options.providers) || options.providers.length === 0) {
    throw new BffIdentityError(
      "IDENTITY_STRATEGY_INVALID",
      500,
      "Identity managers require at least one provider."
    );
  }

  return {
    adapter: options.adapter,
    autoCreate: options.autoCreate,
    ...(options.cacheTTL !== undefined ? { cacheTTL: options.cacheTTL } : {}),
    ...(options.onCreate ? { onCreate: options.onCreate } : {}),
    providers: [...options.providers]
  };
}
