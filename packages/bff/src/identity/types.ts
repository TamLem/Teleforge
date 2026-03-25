import type { BffRequestContext } from "../context/types.js";
import type { BffErrorCode } from "../errors/codes.js";
import type { WebAppUser } from "@teleforge/core";

export interface AppUser {
  id: string;
  [key: string]: unknown;
}

export type IdentityStrategy = "custom" | "telegram-id" | "username";
export type BffIdentityErrorCode = Extract<
  BffErrorCode,
  "IDENTITY_RESOLUTION_FAILED" | "IDENTITY_STRATEGY_INVALID"
>;

export interface ResolvedIdentity<TAppUser extends AppUser = AppUser> {
  appUser: TAppUser | null;
  appUserId: string | null;
  isNewUser: boolean;
  resolvedAt: number;
  telegramUserId: number;
  telegramUsername?: string;
}

export interface IdentityCacheEntry<TAppUser extends AppUser = AppUser> {
  expiresAt: number;
  value: ResolvedIdentity<TAppUser> | null;
}

export interface IdentityAdapter<TAppUser extends AppUser = AppUser> {
  create: (user: Partial<TAppUser>) => Promise<TAppUser> | TAppUser;
  findByTelegramId: (telegramUserId: number) => Promise<TAppUser | null> | TAppUser | null;
  findByUsername: (username: string) => Promise<TAppUser | null> | TAppUser | null;
  update: (appUserId: string, updates: Partial<TAppUser>) => Promise<TAppUser> | TAppUser;
}

export interface IdentityResolverContext<TAppUser extends AppUser = AppUser> {
  adapter: IdentityAdapter<TAppUser>;
  context: BffRequestContext;
  telegramUser: WebAppUser;
}

export type CustomIdentityResolver<TAppUser extends AppUser = AppUser> = (
  input: IdentityResolverContext<TAppUser>
) => Promise<TAppUser | null> | TAppUser | null;

export interface IdentityResolutionOptions<TAppUser extends AppUser = AppUser> {
  adapter: IdentityAdapter<TAppUser>;
  autoCreate: boolean;
  cacheTTL?: number;
  onCreate?: (
    telegramUser: WebAppUser,
    context: BffRequestContext
  ) => Partial<TAppUser> | Promise<Partial<TAppUser>>;
  resolve?: CustomIdentityResolver<TAppUser>;
  strategy: IdentityStrategy;
}
