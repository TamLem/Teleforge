import type { BffRequestContext } from "../context/types.js";

export interface ServiceContext {
  headers: Record<string, string>;
  requestId: string;
  timeout?: number;
  traceId?: string;
}

export interface HealthStatus {
  details?: Record<string, unknown>;
  status: "degraded" | "healthy" | "unhealthy";
}

export interface ServiceAdapter<TConfig = unknown> {
  readonly config: TConfig;
  readonly name: string;
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  health?: () => Promise<HealthStatus>;
  invoke: <TInput, TOutput>(
    operation: string,
    input: TInput,
    context: ServiceContext
  ) => Promise<TOutput>;
}

export interface HttpServiceOperation {
  headers?: Record<string, string>;
  method?: string;
  path: string;
  timeoutMs?: number;
}

export interface HttpRetryPolicy {
  attempts: number;
  maxDelayMs?: number;
  minDelayMs?: number;
}

export interface HttpServiceAdapterConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  operations?: Record<string, HttpServiceOperation | string>;
  retry?: HttpRetryPolicy;
  timeout?: number;
}

export interface BffServiceRouteConfig<TInput, TOutput> {
  name: string;
  operation: string;
  transformInput?: (context: BffRequestContext, input: TInput) => unknown;
  transformOutput?: (context: BffRequestContext, output: unknown) => TOutput;
}

export interface InvokeAdapterOptions {
  headers?: Record<string, string>;
  timeout?: number;
  traceId?: string;
}

export type ServiceMap = Record<string, ServiceAdapter>;
