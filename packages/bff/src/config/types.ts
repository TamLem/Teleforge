import type { AppUser, IdentityAdapter, IdentityResolutionOptions } from "../identity/types.js";
import type { BffCacheStore } from "../route/types.js";
import type { BffRouteConfig, BffRouteDefinition } from "../route/types.js";
import type { SessionAdapter } from "../session/types.js";
import type { LaunchMode } from "@teleforge/core";

export interface BffFeatureFlags {
  completion: boolean;
  requestLogging: boolean;
  sessions: boolean;
}

export interface BffJwtConfig {
  accessTokenExpiry: number;
  refreshTokenExpiry: number;
  secret: string;
}

export interface BffValidationConfig {
  allowedLaunchModes?: readonly LaunchMode[];
  strictInitData: boolean;
}

export interface BffIdentityConfig<TAppUser extends AppUser = AppUser> extends Omit<
  IdentityResolutionOptions<TAppUser>,
  "adapter"
> {
  adapter: IdentityAdapter<TAppUser>;
}

export interface BffConfigOptions<TAppUser extends AppUser = AppUser> {
  adapters?: {
    cache?: BffCacheAdapter;
    session?: SessionAdapter;
  };
  botToken: string;
  features?: Partial<BffFeatureFlags>;
  identity: BffIdentityConfig<TAppUser>;
  jwt?: {
    accessTokenExpiry?: number;
    refreshTokenExpiry?: number;
    secret: string;
  };
  validation?: {
    allowedLaunchModes?: readonly LaunchMode[];
    strictInitData?: boolean;
  };
}

export interface BffConfig<TAppUser extends AppUser = AppUser> {
  readonly adapters: Readonly<{
    cache?: BffCacheAdapter;
    identity: IdentityAdapter<TAppUser>;
    session?: SessionAdapter;
  }>;
  readonly features: Readonly<BffFeatureFlags>;
  readonly identity: Readonly<BffIdentityConfig<TAppUser>>;
  readonly jwt: Readonly<BffJwtConfig | null>;
  readonly options: Readonly<BffResolvedConfigOptions<TAppUser>>;
  readonly validation: Readonly<BffValidationConfig>;
  createRouter(): BffRouter;
  validate(): true;
}

export interface BffResolvedConfigOptions<TAppUser extends AppUser = AppUser> {
  adapters: {
    cache?: BffCacheAdapter;
    session?: SessionAdapter;
  };
  botToken: string;
  features: BffFeatureFlags;
  identity: BffIdentityConfig<TAppUser>;
  jwt: BffJwtConfig | null;
  validation: BffValidationConfig;
}

export interface BffRouter {
  add<TInput, TOutput>(
    route: BffRouteConfig<TInput, TOutput> | BffRouteDefinition<TInput, TOutput>
  ): BffRouteDefinition<TInput, TOutput>;
  createHandler(): (request: Request) => Promise<Response>;
  getAll(): BffRouteDefinition[];
  mountBuiltIns(): void;
}

export type BffCacheAdapter = BffCacheStore;
