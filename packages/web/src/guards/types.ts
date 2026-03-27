import type { TeleforgeManifest } from "@teleforgex/core/browser";

export interface RouteRequirements {
  auth?: boolean;
  capabilities?: string[];
  launchMode?: Array<"inline" | "compact" | "fullscreen">;
  startParam?: string;
}

export interface GuardResult {
  allowed: boolean;
  reason?: string;
  redirectTo?: string;
}

export interface CapabilityGuardProps {
  children?: React.ReactNode;
  fallback?: React.ReactNode;
  manifest?: TeleforgeManifest;
  redirectTo?: string;
  requirements: RouteRequirements;
}
