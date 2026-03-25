import { BffErrorCodes } from "../errors/codes.js";
import { BffValidationError } from "../errors/validation.js";

import type { BffConfigOptions, BffResolvedConfigOptions } from "./types.js";
import type { FieldError } from "../errors/validation.js";
import type { AppUser } from "../identity/types.js";

const DEFAULT_ACCESS_TOKEN_EXPIRY = 60 * 60;
const DEFAULT_REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60;

export function normalizeBffConfigOptions<TAppUser extends AppUser>(
  options: BffConfigOptions<TAppUser>
): BffResolvedConfigOptions<TAppUser> {
  const normalized: BffResolvedConfigOptions<TAppUser> = {
    adapters: {
      ...(options.adapters?.cache ? { cache: options.adapters.cache } : {}),
      ...(options.adapters?.session ? { session: options.adapters.session } : {})
    },
    botToken: options.botToken,
    features: {
      completion: options.features?.completion ?? true,
      requestLogging: options.features?.requestLogging ?? false,
      sessions: options.features?.sessions ?? true
    },
    identity: {
      ...options.identity,
      autoCreate: options.identity.autoCreate ?? true,
      strategy: options.identity.strategy ?? "telegram-id"
    },
    jwt: options.jwt
      ? {
          accessTokenExpiry: options.jwt.accessTokenExpiry ?? DEFAULT_ACCESS_TOKEN_EXPIRY,
          refreshTokenExpiry: options.jwt.refreshTokenExpiry ?? DEFAULT_REFRESH_TOKEN_EXPIRY,
          secret: options.jwt.secret
        }
      : null,
    services: {
      ...(options.services ?? {})
    },
    validation: {
      ...(options.validation?.allowedLaunchModes
        ? { allowedLaunchModes: [...options.validation.allowedLaunchModes] }
        : {}),
      strictInitData: options.validation?.strictInitData ?? true
    }
  };

  validateBffConfigOptions(normalized);

  return normalized;
}

export function validateBffConfigOptions<TAppUser extends AppUser>(
  options: BffResolvedConfigOptions<TAppUser> | BffConfigOptions<TAppUser>
): true {
  const fields: FieldError[] = [];

  if (!options.botToken || options.botToken.trim().length === 0) {
    fields.push({
      code: "required",
      message: "botToken is required.",
      path: "botToken"
    });
  }

  if (!options.identity?.adapter) {
    fields.push({
      code: "required",
      message: "identity.adapter is required.",
      path: "identity.adapter"
    });
  }

  if ((options.features?.sessions ?? true) && !options.adapters?.session) {
    fields.push({
      code: "required",
      message: "adapters.session is required when sessions are enabled.",
      path: "adapters.session"
    });
  }

  if (
    (options.features?.sessions ?? true) &&
    (!options.jwt?.secret || options.jwt.secret.trim().length === 0)
  ) {
    fields.push({
      code: "required",
      message: "jwt.secret is required when sessions are enabled.",
      path: "jwt.secret"
    });
  }

  if (options.jwt?.accessTokenExpiry !== undefined && options.jwt.accessTokenExpiry <= 0) {
    fields.push({
      code: "invalid",
      message: "jwt.accessTokenExpiry must be a positive number.",
      path: "jwt.accessTokenExpiry"
    });
  }

  if (options.jwt?.refreshTokenExpiry !== undefined && options.jwt.refreshTokenExpiry <= 0) {
    fields.push({
      code: "invalid",
      message: "jwt.refreshTokenExpiry must be a positive number.",
      path: "jwt.refreshTokenExpiry"
    });
  }

  for (const [name, service] of Object.entries(options.services ?? {})) {
    if (!service) {
      fields.push({
        code: "required",
        message: `services.${name} is required.`,
        path: `services.${name}`
      });
      continue;
    }

    if (service.name !== name) {
      fields.push({
        code: "invalid",
        message: `services.${name}.name must match the registry key.`,
        path: `services.${name}.name`
      });
    }

    if (typeof service.invoke !== "function") {
      fields.push({
        code: "required",
        message: `services.${name}.invoke must be a function.`,
        path: `services.${name}.invoke`
      });
    }
  }

  if (fields.length > 0) {
    throw new BffValidationError(
      BffErrorCodes.CONFIG_INVALID,
      "BFF configuration is invalid.",
      fields
    );
  }

  return true;
}
