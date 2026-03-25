import type { AppUser, IdentityAdapter } from "../types.js";

export async function resolveByTelegramId<TAppUser extends AppUser>(
  adapter: IdentityAdapter<TAppUser>,
  telegramUserId: number
): Promise<TAppUser | null> {
  return await adapter.findByTelegramId(telegramUserId);
}
