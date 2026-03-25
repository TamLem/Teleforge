import { resolveIdentity } from "./resolve.js";

import type { AppUser, IdentityResolutionOptions } from "./types.js";
import type { BffMiddleware } from "../route/types.js";

export function withIdentityResolution<TAppUser extends AppUser = AppUser>(
  options: IdentityResolutionOptions<TAppUser>
): BffMiddleware {
  return async (context, next) => {
    await resolveIdentity(context, options);
    return await next();
  };
}
