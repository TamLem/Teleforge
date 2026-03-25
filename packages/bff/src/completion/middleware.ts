import { buildBffResponse } from "./helpers.js";

import type { CompletionAction } from "./types.js";
import type { BffMiddleware } from "../route/types.js";

export function withCompletionHandler(
  getAction: (
    context: Parameters<BffMiddleware>[0],
    result: unknown
  ) => CompletionAction | undefined
): BffMiddleware {
  return async (context, next) => {
    const result = await next();
    const action = getAction(context, result);

    if (!action) {
      return result;
    }

    return buildBffResponse(result, {
      completion: action
    });
  };
}
