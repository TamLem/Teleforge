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
      ...(config.launchModes ? { launchModes: [...config.launchModes] } : {}),
      ...(config.permissions ? { permissions: [...config.permissions] } : {})
    }) as Readonly<BffRouteConfig<TInput, TOutput>>
  };
}
