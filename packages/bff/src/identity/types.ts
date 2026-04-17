import type { BffRequestContext } from "../context/types.js";
import type { BffErrorCode } from "../errors/codes.js";
import type { WebAppUser } from "@teleforgex/core";

export interface AppUser {
  id: string;
  [key: string]: unknown;
}

export type BffIdentityErrorCode = Extract<
  BffErrorCode,
  "IDENTITY_RESOLUTION_FAILED" | "IDENTITY_STRATEGY_INVALID"
>;

export interface ResolvedIdentity<TAppUser extends AppUser = AppUser> {
  appUser: TAppUser | null;
  appUserId: string | null;
  isNewUser: boolean;
  phoneNumber?: string;
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
  findByPhoneNumber?: (phoneNumber: string) => Promise<TAppUser | null> | TAppUser | null;
  findByTelegramId: (telegramUserId: number) => Promise<TAppUser | null> | TAppUser | null;
  findByUsername: (username: string) => Promise<TAppUser | null> | TAppUser | null;
  update?: (appUserId: string, updates: Partial<TAppUser>) => Promise<TAppUser> | TAppUser;
}

export interface PhoneIdentityAdapter<TAppUser extends AppUser = AppUser>
  extends IdentityAdapter<TAppUser> {
  findByPhoneNumber: (phoneNumber: string) => Promise<TAppUser | null> | TAppUser | null;
}

export interface IdentityResolveInput {
  phoneAuthToken?: string;
}

export interface IdentityProviderContext<TAppUser extends AppUser = AppUser> {
  adapter: IdentityAdapter<TAppUser>;
  context: BffRequestContext;
  input: IdentityResolveInput;
  telegramUser: WebAppUser;
}

export interface IdentityProviderResult<TAppUser extends AppUser = AppUser> {
  appUser: TAppUser | null;
  createInput?: Partial<TAppUser>;
  phoneNumber?: string;
}

export interface IdentityProvider<TAppUser extends AppUser = AppUser> {
  name: string;
  resolve: (
    input: IdentityProviderContext<TAppUser>
  ) =>
    | Promise<IdentityProviderResult<TAppUser> | null>
    | IdentityProviderResult<TAppUser>
    | null;
}

export type CustomIdentityProviderResolver<TAppUser extends AppUser = AppUser> = (
  input: IdentityProviderContext<TAppUser>
) =>
  | Promise<IdentityProviderResult<TAppUser> | null>
  | IdentityProviderResult<TAppUser>
  | null;

export interface IdentityManager<TAppUser extends AppUser = AppUser> {
  adapter: IdentityAdapter<TAppUser>;
  autoCreate: boolean;
  cacheTTL?: number;
  onCreate?: (
    telegramUser: WebAppUser,
    context: BffRequestContext
  ) => Partial<TAppUser> | Promise<Partial<TAppUser>>;
  providers: readonly IdentityProvider<TAppUser>[];
}

export interface IdentityResolutionOptions<TAppUser extends AppUser = AppUser> {
  adapter: IdentityAdapter<TAppUser>;
  autoCreate: boolean;
  cacheTTL?: number;
  onCreate?: (
    telegramUser: WebAppUser,
    context: BffRequestContext
  ) => Partial<TAppUser> | Promise<Partial<TAppUser>>;
  providers: readonly IdentityProvider<TAppUser>[];
}

export interface PhoneAuthOptions<TAppUser extends AppUser = AppUser>
  extends Omit<IdentityResolutionOptions<TAppUser>, "adapter" | "providers"> {
  adapter: PhoneIdentityAdapter<TAppUser>;
  secret: string;
}
