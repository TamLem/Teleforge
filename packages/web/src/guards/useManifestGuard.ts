import { useMemo } from "react";

import { useManifest } from "./ManifestContext.js";
import { useRouteGuard } from "./useRouteGuard.js";

import type { GuardResult, RouteRequirements } from "./types.js";
import type { TeleforgeManifest } from "@teleforge/core/browser";

export function useManifestGuard(
  routePath: string,
  overrideManifest?: TeleforgeManifest
): GuardResult {
  const contextManifest = useManifest(true);
  const manifest = overrideManifest ?? contextManifest;

  const requirements = useMemo<RouteRequirements | null>(() => {
    if (!manifest) {
      return null;
    }

    const route = manifest.routes.find((entry) => entry.path === routePath);
    if (!route) {
      return null;
    }

    const guardCapabilities = (route.guards ?? []).filter((guard) => guard !== "auth");
    const requirementsFromRoute: RouteRequirements = {};

    if (route.launchModes && route.launchModes.length > 0) {
      requirementsFromRoute.launchMode = route.launchModes.filter(isLaunchMode);
    } else if (route.capabilities?.launchMode) {
      requirementsFromRoute.launchMode = [route.capabilities.launchMode];
    }

    if (route.capabilities?.auth || (route.guards ?? []).includes("auth")) {
      requirementsFromRoute.auth = true;
    }

    const capabilities = [
      ...guardCapabilities,
      route.capabilities?.payments ? "payments" : null
    ].filter((value): value is string => Boolean(value));

    if (capabilities.length > 0) {
      requirementsFromRoute.capabilities = capabilities;
    }

    return requirementsFromRoute;
  }, [manifest, routePath]);

  const baseGuard = useRouteGuard(requirements ?? {});

  if (!manifest) {
    return {
      allowed: false,
      reason: "Manifest not available."
    };
  }

  if (!requirements) {
    return {
      allowed: false,
      reason: "Route not found.",
      redirectTo: manifest.routes[0]?.path ?? "/"
    };
  }

  if (!baseGuard.allowed) {
    return {
      ...baseGuard,
      redirectTo: baseGuard.redirectTo ?? manifest.routes[0]?.path ?? "/"
    };
  }

  return baseGuard;
}

function isLaunchMode(value: string): value is "inline" | "compact" | "fullscreen" {
  return value === "inline" || value === "compact" || value === "fullscreen";
}
