import type { BffServiceRouteConfig } from "../adapters/types.js";
import type { CompletionResolver } from "../completion/types.js";
import type { BffRequestContext } from "../context/types.js";
import type { BffErrorCode } from "../errors/codes.js";
import type { LaunchMode, RouteCoordinationMetadata } from "@teleforge/core";

export type BffAuthMode = "optional" | "public" | "required";
export type BffRouteMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
export type BffRouteErrorCode = Extract<
  BffErrorCode,
  | "DUPLICATE_HANDLER"
  | "DUPLICATE_ROUTE"
  | "LAUNCH_MODE_NOT_ALLOWED"
  | "MISSING_HANDLER"
  | "UNAUTHENTICATED"
>;
export type BffMiddleware = (
  context: BffRequestContext,
  next: () => Promise<unknown>
) => Promise<unknown> | unknown;
export type BffCompletionConfig<TOutput> = CompletionResolver<TOutput>;

export interface CachePolicy {
  key?: string;
  maxAgeMs: number;
  scope?: "private" | "public";
}

export type BffHandler<TInput, TOutput> = (
  context: BffRequestContext,
  input: TInput
) => Promise<TOutput> | TOutput;

export interface ProxyConfig<TInput, TOutput> {
  action: string;
  service: string;
  transform?: {
    request?: (context: BffRequestContext, input: TInput) => unknown;
    response?: (context: BffRequestContext, output: unknown) => TOutput;
  };
}

interface BffRouteBaseConfig<TOutput> {
  auth: BffAuthMode;
  cache?: CachePolicy;
  completion?: CompletionResolver<TOutput>;
  coordination?: RouteCoordinationMetadata;
  launchModes?: readonly LaunchMode[];
  method: BffRouteMethod;
  middlewares?: readonly BffMiddleware[];
  path: string;
  permissions?: readonly string[];
  timeoutMs?: number;
}

interface BffRouteHandlerConfig<TInput, TOutput> extends BffRouteBaseConfig<TOutput> {
  handler: BffHandler<TInput, TOutput>;
  proxy?: never;
  service?: never;
}

interface BffRouteServiceConfig<TInput, TOutput> extends BffRouteBaseConfig<TOutput> {
  handler?: never;
  proxy?: never;
  service: BffServiceRouteConfig<TInput, TOutput>;
}

interface BffRouteProxyConfig<TInput, TOutput> extends BffRouteBaseConfig<TOutput> {
  handler?: never;
  service?: never;
  proxy: ProxyConfig<TInput, TOutput>;
}

export type BffRouteConfig<TInput, TOutput> =
  | BffRouteHandlerConfig<TInput, TOutput>
  | BffRouteServiceConfig<TInput, TOutput>
  | BffRouteProxyConfig<TInput, TOutput>;

export interface BffRouteDefinition<TInput = unknown, TOutput = unknown> {
  _input?: TInput;
  _output?: TOutput;
  config: Readonly<BffRouteConfig<TInput, TOutput>>;
}

export interface BffRouteMatch<TInput = unknown, TOutput = unknown> {
  params: Record<string, string>;
  route: BffRouteDefinition<TInput, TOutput>;
}

export interface BffExecutionOptions<TInput = unknown, TOutput = unknown> {
  cacheStore?: BffCacheStore;
  invokeService?: (
    service: BffServiceRouteConfig<TInput, TOutput>,
    context: BffRequestContext,
    input: unknown
  ) => Promise<unknown> | unknown;
  invokeProxy?: (
    proxy: ProxyConfig<TInput, TOutput>,
    context: BffRequestContext,
    input: unknown
  ) => Promise<unknown> | unknown;
}

export interface BffCacheStore {
  get: (key: string) => Promise<unknown | undefined> | unknown | undefined;
  set: (key: string, value: unknown, ttlMs: number) => Promise<void> | void;
}
