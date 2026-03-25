import { BffRouteError } from "../route/errors.js";

import type { BffRequestContext } from "../context/types.js";
import type { BffAuthMode } from "../route/types.js";

export function enforceBffAuth(auth: BffAuthMode, context: BffRequestContext): void {
  if (auth !== "required") {
    return;
  }

  if (!context.telegramUser && !context.initDataRaw) {
    context.setStatus(401);
    throw new BffRouteError(
      "UNAUTHENTICATED",
      401,
      "This BFF route requires Telegram authentication."
    );
  }
}
