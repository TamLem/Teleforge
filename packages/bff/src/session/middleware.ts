import { validateSession } from "./validate.js";

import type { SessionValidationOptions } from "./types.js";
import type { BffMiddleware } from "../route/types.js";

export function withSessionValidation(options: SessionValidationOptions): BffMiddleware {
  return async (context, next) => {
    await validateSession(context, options);
    return await next();
  };
}
