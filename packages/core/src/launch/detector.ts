import { normalizePlatform } from "../utils/platform.js";

import type { DetectCapabilitiesOptions, LaunchCapabilities, LaunchMode } from "./types.js";

export function detectLaunchMode(
  viewportHeight: number,
  platform: string
): Exclude<LaunchMode, "unknown"> {
  const normalizedPlatform = normalizePlatform(platform);

  if (viewportHeight >= 720) {
    return "fullscreen";
  }

  if (viewportHeight >= 320) {
    return normalizedPlatform === "desktop" ||
      normalizedPlatform === "web" ||
      normalizedPlatform === "macos"
      ? "fullscreen"
      : "compact";
  }

  return "inline";
}

export function detectCapabilities({
  initDataUnsafe,
  launchMode = "unknown",
  platform,
  version
}: DetectCapabilitiesOptions): LaunchCapabilities {
  const mobilePlatform = platform === "ios" || platform === "android";
  const supportsReadAccess =
    Boolean(initDataUnsafe?.user) ||
    Boolean(initDataUnsafe?.receiver) ||
    Boolean(initDataUnsafe?.query_id) ||
    Boolean(initDataUnsafe?.hash);
  const supportsWriteAccess =
    compareVersions(version, "6.9") >= 0 ||
    Boolean(initDataUnsafe?.user?.allows_write_to_pm) ||
    typeof initDataUnsafe?.can_send_after === "number";

  const capabilities: LaunchCapabilities = {
    supported: [],
    supportsCloudStorage: compareVersions(version, "6.9") >= 0,
    supportsCompact: launchMode === "compact" || platform === "ios" || platform === "android",
    supportsFullscreen:
      launchMode === "fullscreen" ||
      platform === "desktop" ||
      platform === "web" ||
      platform === "macos" ||
      compareVersions(version, "8.0") >= 0,
    supportsHapticFeedback: compareVersions(version, "6.1") >= 0 && mobilePlatform,
    supportsInline: launchMode === "inline",
    supportsPayments: compareVersions(version, "6.1") >= 0,
    supportsReadAccess,
    supportsWriteAccess
  };

  capabilities.supported = [
    capabilities.supportsInline ? "inline" : null,
    capabilities.supportsCompact ? "compact" : null,
    capabilities.supportsFullscreen ? "fullscreen" : null,
    capabilities.supportsPayments ? "payments" : null,
    capabilities.supportsCloudStorage ? "cloud_storage" : null,
    capabilities.supportsHapticFeedback ? "haptic_feedback" : null,
    capabilities.supportsReadAccess ? "read_access" : null,
    capabilities.supportsWriteAccess ? "write_access" : null
  ].filter((value): value is string => value !== null);

  return capabilities;
}

function compareVersions(left: string, right: string): number {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue > rightValue) {
      return 1;
    }

    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

function parseVersion(version: string): number[] {
  return version
    .split(".")
    .map((segment) => Number.parseInt(segment, 10))
    .filter((segment) => Number.isFinite(segment));
}
