import { ConfiguredBffRouter } from "./router.js";
import { normalizeBffConfigOptions, validateBffConfigOptions } from "./validate.js";

import type { BffConfig, BffConfigOptions } from "./types.js";
import type { AppUser } from "../identity/types.js";

export function createBffConfig<TAppUser extends AppUser = AppUser>(
  options: BffConfigOptions<TAppUser>
): BffConfig<TAppUser> {
  const normalized = normalizeBffConfigOptions(options);
  const config: BffConfig<TAppUser> = {
    adapters: deepFreeze({
      ...(normalized.adapters.cache ? { cache: normalized.adapters.cache } : {}),
      identity: normalized.identity.adapter,
      ...(normalized.adapters.session ? { session: normalized.adapters.session } : {})
    }),
    events: normalized.events,
    features: deepFreeze(normalized.features),
    identity: deepFreeze(normalized.identity),
    jwt: deepFreeze(normalized.jwt),
    options: deepFreeze(normalized),
    services: deepFreeze({
      ...normalized.services
    }),
    validation: deepFreeze(normalized.validation),
    createRouter() {
      return new ConfiguredBffRouter(config);
    },
    validate() {
      return validateBffConfigOptions(normalized);
    }
  };

  return Object.freeze(config);
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (!value || typeof value !== "object") {
    return value as Readonly<T>;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      deepFreeze(entry);
    }
  } else {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }

  return Object.freeze(value);
}
