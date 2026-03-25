import { validateCompletionAction } from "./validate.js";

import type { BffResponse, CompletionAction, CompletionEnvelope } from "./types.js";
import type { BffRequestContext } from "../context/types.js";
import type { BffRouteDefinition } from "../route/types.js";

export function buildBffResponse<T>(
  data: T,
  options: {
    completion?: CompletionAction | CompletionEnvelope;
    meta?: Record<string, unknown>;
  } = {}
): BffResponse<T> {
  if (!options.completion) {
    return {
      data
    };
  }

  if (isCompletionEnvelope(options.completion)) {
    validateCompletionAction(options.completion.action);

    return {
      completion: options.completion,
      data
    };
  }

  return withCompletion(data, options.completion, options.meta);
}

export function buildRouteResponse<TInput, TOutput>(
  route: BffRouteDefinition<TInput, TOutput>,
  context: BffRequestContext,
  result: TOutput
): BffResponse<TOutput> {
  const completion = resolveRouteCompletion(route, context, result);

  return buildBffResponse(result, {
    ...(completion ? { completion } : {})
  });
}

export function resolveRouteCompletion<TInput, TOutput>(
  route: BffRouteDefinition<TInput, TOutput>,
  context: BffRequestContext,
  result: TOutput
): CompletionEnvelope | undefined {
  const completionConfig = route.config.completion;

  if (!completionConfig) {
    return undefined;
  }

  const action =
    typeof completionConfig === "function" ? completionConfig(context, result) : completionConfig;

  if (!action) {
    return undefined;
  }

  return {
    action: validateCompletionAction(action),
    version: "1.0"
  };
}

export function withCompletion<T>(
  data: T,
  action: CompletionAction,
  meta?: Record<string, unknown>
): BffResponse<T> {
  return {
    completion: {
      action: validateCompletionAction(action),
      ...(meta ? { meta } : {}),
      version: "1.0"
    },
    data
  };
}

function isCompletionEnvelope(
  value: CompletionAction | CompletionEnvelope
): value is CompletionEnvelope {
  return "action" in value && "version" in value;
}
