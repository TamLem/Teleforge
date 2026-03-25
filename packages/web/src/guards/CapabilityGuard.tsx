import React, { useEffect } from "react";

import { hasWindow } from "../utils/ssr.js";

import { useRouteGuard } from "./useRouteGuard.js";

import type { CapabilityGuardProps } from "./types.js";

export function CapabilityGuard({
  children,
  fallback,
  redirectTo,
  requirements
}: CapabilityGuardProps) {
  const guard = useRouteGuard(requirements);
  const target = redirectTo ?? guard.redirectTo;

  useEffect(() => {
    if (guard.allowed || fallback || !target || !hasWindow()) {
      return;
    }

    window.location.assign(target);
  }, [fallback, guard.allowed, target]);

  if (!guard.allowed) {
    if (fallback) {
      return React.createElement(React.Fragment, null, fallback);
    }

    if (target) {
      return null;
    }

    return React.createElement("div", null, `Access denied: ${guard.reason ?? "Blocked."}`);
  }

  return React.createElement(React.Fragment, null, children);
}
