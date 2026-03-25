import { BffError } from "../errors/base.js";
import { BffErrorCodes } from "../errors/codes.js";

import { ServiceAdapterRegistry } from "./registry.js";

import type { InvokeAdapterOptions, ServiceAdapter, ServiceContext, ServiceMap } from "./types.js";
import type { BffRequestContext } from "../context/types.js";

export async function invokeAdapter<TOutput>(
  services: ServiceAdapterRegistry | ServiceMap,
  serviceName: string,
  operation: string,
  input: unknown,
  context: BffRequestContext,
  options: InvokeAdapterOptions = {}
): Promise<TOutput> {
  const adapter = resolveAdapter(services, serviceName);

  if (!adapter) {
    throw BffError.fromCode(BffErrorCodes.SERVICE_NOT_FOUND, {
      message: `No service adapter named ${serviceName} is registered.`,
      meta: {
        operation,
        service: serviceName
      }
    });
  }

  return await adapter.invoke<unknown, TOutput>(
    operation,
    input,
    createServiceContext(context, options)
  );
}

function createServiceContext(
  context: BffRequestContext,
  options: InvokeAdapterOptions
): ServiceContext {
  const traceId = options.traceId ?? context.header("x-trace-id") ?? context.id;
  const headers: Record<string, string> = {
    "x-request-id": context.id,
    "x-trace-id": traceId,
    ...(context.header("authorization")
      ? { authorization: context.header("authorization") as string }
      : {}),
    ...(options.headers ?? {})
  };

  return {
    headers,
    requestId: context.id,
    ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
    traceId
  };
}

function resolveAdapter(
  services: ServiceAdapterRegistry | ServiceMap,
  serviceName: string
): ServiceAdapter | undefined {
  if (services instanceof ServiceAdapterRegistry) {
    return services.get(serviceName);
  }

  return services[serviceName];
}
