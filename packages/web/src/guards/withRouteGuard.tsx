import React from "react";

import { CapabilityGuard } from "./CapabilityGuard.js";

import type { RouteRequirements } from "./types.js";

export interface WithRouteGuardOptions {
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export function withRouteGuard<P extends object>(
  Component: React.ComponentType<P>,
  requirements: RouteRequirements,
  options: WithRouteGuardOptions = {}
) {
  return function GuardedComponent(props: P) {
    return React.createElement(
      CapabilityGuard,
      {
        fallback: options.fallback,
        redirectTo: options.redirectTo,
        requirements
      },
      React.createElement(Component, props)
    );
  };
}
