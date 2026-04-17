import { verifySignedPhoneAuthToken } from "@teleforgex/core";

import { createIdentityManager } from "./manager.js";
import { phoneAuthIdentityProvider } from "./providers.js";
import { resolveIdentity } from "./resolve.js";

import type { AppUser, PhoneAuthOptions, ResolvedIdentity } from "./types.js";
import type { BffRequestContext } from "../context/types.js";

export async function resolvePhoneAuthIdentity<TAppUser extends AppUser = AppUser>(
  context: BffRequestContext,
  phoneAuthToken: string,
  options: PhoneAuthOptions<TAppUser>
): Promise<ResolvedIdentity<TAppUser> | null> {
  return await resolveIdentity(
    context,
    createIdentityManager({
      adapter: options.adapter,
      autoCreate: options.autoCreate,
      ...(options.cacheTTL !== undefined ? { cacheTTL: options.cacheTTL } : {}),
      ...(options.onCreate ? { onCreate: options.onCreate } : {}),
      providers: [
        phoneAuthIdentityProvider({
          findByPhoneNumber: options.adapter.findByPhoneNumber,
          verify: async (token) =>
            await verifySignedPhoneAuthToken(token, options.secret, {
              now: context.timestamp
            })
        })
      ]
    }),
    {
      phoneAuthToken
    }
  );
}
