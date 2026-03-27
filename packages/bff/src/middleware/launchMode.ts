import { BffRouteError } from "../route/errors.js";

import type { BffRequestContext } from "../context/types.js";
import type { LaunchMode } from "@teleforgex/core";

export function enforceLaunchModes(
  launchModes: readonly LaunchMode[] | undefined,
  context: BffRequestContext
): void {
  if (!launchModes || launchModes.length === 0) {
    return;
  }

  if (launchModes.includes(context.launchMode)) {
    return;
  }

  context.setStatus(403);
  throw new BffRouteError(
    "LAUNCH_MODE_NOT_ALLOWED",
    403,
    `Launch mode "${context.launchMode}" is not allowed for this BFF route.`
  );
}
