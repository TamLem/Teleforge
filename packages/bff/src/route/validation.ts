import { BffRouteError } from "./errors.js";

import type { BffRouteConfig } from "./types.js";

export function validateBffRouteConfig<TInput, TOutput>(
  config: {
    handler?: unknown;
    proxy?: unknown;
  } & Partial<BffRouteConfig<TInput, TOutput>>
) {
  const hasHandler = typeof config.handler === "function";
  const hasProxy = Boolean(config.proxy);

  if (!hasHandler && !hasProxy) {
    throw new BffRouteError(
      "MISSING_HANDLER",
      500,
      "BFF routes must declare exactly one of `handler` or `proxy`."
    );
  }

  if (hasHandler && hasProxy) {
    throw new BffRouteError(
      "DUPLICATE_HANDLER",
      500,
      "BFF routes cannot declare both `handler` and `proxy`."
    );
  }
}
