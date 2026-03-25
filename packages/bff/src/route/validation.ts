import { validateCompletionAction } from "../completion/validate.js";
import { BffError } from "../errors/base.js";
import { BffErrorCodes } from "../errors/codes.js";

import { BffRouteError } from "./errors.js";

import type { BffRouteConfig } from "./types.js";

export function validateBffRouteConfig<TInput, TOutput>(
  config: {
    handler?: unknown;
    proxy?: unknown;
    service?: unknown;
  } & Partial<BffRouteConfig<TInput, TOutput>>
) {
  const hasHandler = typeof config.handler === "function";
  const hasService = Boolean(config.service);
  const hasProxy = Boolean(config.proxy);
  const configuredHandlers = [hasHandler, hasService, hasProxy].filter(Boolean).length;

  if (configuredHandlers === 0) {
    throw new BffRouteError(
      "MISSING_HANDLER",
      500,
      "BFF routes must declare exactly one of `handler`, `service`, or `proxy`."
    );
  }

  if (configuredHandlers > 1) {
    throw new BffRouteError(
      "DUPLICATE_HANDLER",
      500,
      "BFF routes cannot declare more than one of `handler`, `service`, or `proxy`."
    );
  }

  if (config.completion && typeof config.completion !== "function") {
    try {
      validateCompletionAction(config.completion);
    } catch (error) {
      throw error instanceof BffError
        ? error
        : BffError.fromCode(BffErrorCodes.INVALID_COMPLETION_CONFIG, {
            message: error instanceof Error ? error.message : "Invalid completion configuration."
          });
    }
  }
}
