import { useLaunch } from "../hooks/useLaunch.js";
import { hasCapability } from "../utils/capabilities.js";

import type { GuardResult, RouteRequirements } from "./types.js";

export function useRouteGuard(requirements: RouteRequirements): GuardResult {
  const { capabilities, context, isAuthenticated, isReady, mode, startParam } = useLaunch();

  if (!isReady) {
    return {
      allowed: false,
      reason: "Launch context not ready."
    };
  }

  if (requirements.launchMode && mode) {
    if (mode === "unknown" || !requirements.launchMode.includes(mode)) {
      return {
        allowed: false,
        reason: `Launch mode '${mode}' not in [${requirements.launchMode.join(", ")}]`,
        redirectTo: "/unsupported"
      };
    }
  }

  if (requirements.auth && !isAuthenticated) {
    return {
      allowed: false,
      reason: "Authentication required.",
      redirectTo: "/login"
    };
  }

  if (requirements.capabilities && requirements.capabilities.length > 0) {
    const missing = requirements.capabilities.filter(
      (capability) =>
        !hasCapability(capability, {
          capabilities: context?.capabilities ?? capabilitiesToFallback(capabilities),
          context
        })
    );

    if (missing.length > 0) {
      return {
        allowed: false,
        reason: `Missing capabilities: ${missing.join(", ")}`,
        redirectTo: "/unsupported"
      };
    }
  }

  if (requirements.startParam) {
    const pattern = new RegExp(requirements.startParam);
    if (!startParam || !pattern.test(startParam)) {
      return {
        allowed: false,
        reason: "Invalid start parameter.",
        redirectTo: "/"
      };
    }
  }

  return {
    allowed: true
  };
}

function capabilitiesToFallback(capabilities: ReturnType<typeof useLaunch>["capabilities"]) {
  return {
    supported: [],
    supportsCloudStorage: capabilities.supportsCloudStorage,
    supportsCompact: false,
    supportsFullscreen: false,
    supportsHapticFeedback: capabilities.supportsHapticFeedback,
    supportsInline: false,
    supportsPayments: capabilities.supportsPayments,
    supportsReadAccess: false,
    supportsWriteAccess: false
  };
}
