import { BffIdentityError } from "./errors.js";

import type {
  AppUser,
  CustomIdentityProviderResolver,
  IdentityProvider,
  IdentityProviderResult
} from "./types.js";
import type { PhoneAuthTokenPayload } from "@teleforgex/core";

export function telegramIdIdentityProvider<
  TAppUser extends AppUser = AppUser
>(): IdentityProvider<TAppUser> {
  return {
    name: "telegram-id",
    async resolve({ adapter, telegramUser }) {
      return {
        appUser: await adapter.findByTelegramId(telegramUser.id)
      };
    }
  };
}

export function usernameIdentityProvider<
  TAppUser extends AppUser = AppUser
>(): IdentityProvider<TAppUser> {
  return {
    name: "username",
    async resolve({ adapter, telegramUser }) {
      return {
        appUser: telegramUser.username ? await adapter.findByUsername(telegramUser.username) : null
      };
    }
  };
}

export function customIdentityProvider<TAppUser extends AppUser = AppUser>(
  resolve: CustomIdentityProviderResolver<TAppUser>
): IdentityProvider<TAppUser> {
  return {
    name: "custom",
    async resolve(input) {
      return await resolve(input);
    }
  };
}

export function phoneAuthIdentityProvider<TAppUser extends AppUser = AppUser>(options: {
  findByPhoneNumber: (phoneNumber: string) => Promise<TAppUser | null> | TAppUser | null;
  verify: (token: string) => Promise<PhoneAuthTokenPayload | null> | PhoneAuthTokenPayload | null;
}): IdentityProvider<TAppUser> {
  return {
    name: "phone-auth",
    async resolve({ context, input, telegramUser }) {
      const phoneAuthToken = input.phoneAuthToken;

      if (!phoneAuthToken) {
        throw new BffIdentityError(
          "IDENTITY_RESOLUTION_FAILED",
          401,
          "Phone auth requires a phoneAuthToken."
        );
      }

      const payload = await options.verify(phoneAuthToken);

      if (!payload) {
        throw new BffIdentityError(
          "IDENTITY_RESOLUTION_FAILED",
          401,
          "Phone auth token is invalid or expired."
        );
      }

      if (payload.telegramUserId !== telegramUser.id) {
        context.setStatus(401);
        throw new BffIdentityError(
          "IDENTITY_RESOLUTION_FAILED",
          401,
          "Phone auth token does not match the active Telegram user."
        );
      }

      return {
        appUser: await options.findByPhoneNumber(payload.phoneNumber),
        createInput: {
          phoneNumber: payload.phoneNumber
        } as unknown as Partial<TAppUser>,
        phoneNumber: payload.phoneNumber
      } satisfies IdentityProviderResult<TAppUser>;
    }
  };
}
