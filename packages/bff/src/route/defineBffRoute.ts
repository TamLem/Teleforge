import { validateBffRouteConfig } from "./validation.js";

import type { BffRouteConfig, BffRouteDefinition } from "./types.js";

/**
 * Declares a Teleforge BFF route while preserving request/response types for future client codegen.
 */
export function defineBffRoute<TInput, TOutput>(
  config: BffRouteConfig<TInput, TOutput>
): BffRouteDefinition<TInput, TOutput> {
  validateBffRouteConfig(config);

  return {
    config: Object.freeze({
      ...config,
      ...(config.coordination
        ? {
            coordination: {
              ...config.coordination,
              entryPoints: [...config.coordination.entryPoints]
            }
          }
        : {}),
      ...(config.launchModes ? { launchModes: [...config.launchModes] } : {}),
      ...(config.middlewares ? { middlewares: [...config.middlewares] } : {}),
      ...(config.permissions ? { permissions: [...config.permissions] } : {})
    }) as Readonly<BffRouteConfig<TInput, TOutput>>
  };
}
