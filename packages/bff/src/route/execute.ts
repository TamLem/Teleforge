import { enforceBffAuth } from "../middleware/auth.js";
import { runWithCache } from "../middleware/cache.js";
import { enforceLaunchModes } from "../middleware/launchMode.js";
import { withExecutionTimeout } from "../middleware/timeout.js";

import type { BffExecutionOptions, BffRouteDefinition } from "./types.js";
import type { BffRequestContext } from "../context/types.js";

export async function executeBffRoute<TInput, TOutput>(
  route: BffRouteDefinition<TInput, TOutput>,
  context: BffRequestContext,
  input: TInput,
  options: BffExecutionOptions<TInput, TOutput> = {}
): Promise<TOutput> {
  enforceBffAuth(route.config.auth, context);
  enforceLaunchModes(route.config.launchModes, context);

  const execute = async () => {
    if ("handler" in route.config && route.config.handler) {
      return await route.config.handler(context, input);
    }

    if (!options.invokeProxy) {
      throw new Error(
        `No proxy invoker was provided for ${route.config.method} ${route.config.path}.`
      );
    }

    const proxyInput = route.config.proxy.transform?.request
      ? route.config.proxy.transform.request(context, input)
      : input;
    const proxyOutput = await options.invokeProxy(route.config.proxy, context, proxyInput);

    return route.config.proxy.transform?.response
      ? route.config.proxy.transform.response(context, proxyOutput)
      : (proxyOutput as TOutput);
  };

  const cacheKey = `${route.config.method}:${route.config.path}:${JSON.stringify(input ?? null)}`;

  return await runWithCache(options.cacheStore, route.config.cache, cacheKey, () =>
    withExecutionTimeout(execute, route.config.timeoutMs)
  );
}
