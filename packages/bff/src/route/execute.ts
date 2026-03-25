import { BffError } from "../errors/base.js";
import { BffErrorCodes } from "../errors/codes.js";
import { enforceBffAuth } from "../middleware/auth.js";
import { runWithCache } from "../middleware/cache.js";
import { runMiddlewares } from "../middleware/compose.js";
import { enforceLaunchModes } from "../middleware/launchMode.js";
import { withExecutionTimeout } from "../middleware/timeout.js";

import { normalizeRouteServiceConfig, toLegacyProxyConfig } from "./service.js";

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

  const executeHandler = async () => {
    if ("handler" in route.config && route.config.handler) {
      return await route.config.handler(context, input);
    }

    const serviceConfig = normalizeRouteServiceConfig(route.config);

    if (!serviceConfig) {
      throw BffError.fromCode(BffErrorCodes.INTERNAL_ERROR, {
        message: `No service configuration was provided for ${route.config.method} ${route.config.path}.`,
        meta: {
          method: route.config.method,
          path: route.config.path
        }
      });
    }

    const serviceInput = serviceConfig.transformInput
      ? serviceConfig.transformInput(context, input)
      : input;

    if (options.invokeService) {
      const serviceOutput = await options.invokeService(serviceConfig, context, serviceInput);

      return serviceConfig.transformOutput
        ? serviceConfig.transformOutput(context, serviceOutput)
        : (serviceOutput as TOutput);
    }

    if (options.invokeProxy) {
      const serviceOutput = await options.invokeProxy(
        toLegacyProxyConfig(serviceConfig),
        context,
        serviceInput
      );

      return serviceConfig.transformOutput
        ? serviceConfig.transformOutput(context, serviceOutput)
        : (serviceOutput as TOutput);
    }

    throw BffError.fromCode(BffErrorCodes.INTERNAL_ERROR, {
      message: `No service invoker was provided for ${route.config.method} ${route.config.path}.`,
      meta: {
        method: route.config.method,
        path: route.config.path,
        service: serviceConfig.name
      }
    });
  };

  const cacheKey = `${route.config.method}:${route.config.path}:${JSON.stringify(input ?? null)}`;

  const execute = async () =>
    await withExecutionTimeout(
      () => runWithCache(options.cacheStore, route.config.cache, cacheKey, executeHandler),
      route.config.timeoutMs
    );

  return await runMiddlewares(route.config.middlewares, context, execute);
}
