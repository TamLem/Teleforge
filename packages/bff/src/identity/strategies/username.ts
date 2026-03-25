import type { AppUser, IdentityAdapter } from "../types.js";

export async function resolveByUsername<TAppUser extends AppUser>(
  adapter: IdentityAdapter<TAppUser>,
  username: string | undefined
): Promise<TAppUser | null> {
  if (!username) {
    return null;
  }

  return await adapter.findByUsername(username);
}
