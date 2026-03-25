import type { ProxyConfig } from "./types.js";
import type { BffServiceRouteConfig } from "../adapters/types.js";

export function normalizeRouteServiceConfig<TInput, TOutput>(config: {
  proxy?: ProxyConfig<TInput, TOutput>;
  service?: BffServiceRouteConfig<TInput, TOutput>;
}) {
  if (config.service) {
    return config.service;
  }

  if (!config.proxy) {
    return undefined;
  }

  return {
    name: config.proxy.service,
    operation: config.proxy.action,
    ...(config.proxy.transform?.request ? { transformInput: config.proxy.transform.request } : {}),
    ...(config.proxy.transform?.response
      ? { transformOutput: config.proxy.transform.response }
      : {})
  } satisfies BffServiceRouteConfig<TInput, TOutput>;
}

export function toLegacyProxyConfig<TInput, TOutput>(
  service: BffServiceRouteConfig<TInput, TOutput>
): ProxyConfig<TInput, TOutput> {
  return {
    action: service.operation,
    service: service.name,
    ...(service.transformInput || service.transformOutput
      ? {
          transform: {
            ...(service.transformInput ? { request: service.transformInput } : {}),
            ...(service.transformOutput ? { response: service.transformOutput } : {})
          }
        }
      : {})
  };
}
