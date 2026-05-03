import type { LaunchContext, ValidateLaunchOptions, ValidateLaunchResult } from "./types.js";

export function validateLaunchAgainstManifest({
  context,
  manifest
}: ValidateLaunchOptions): ValidateLaunchResult {
  const errors: string[] = [];

  if (
    context.launchMode === "unknown" ||
    !manifest.miniApp.launchModes.includes(context.launchMode)
  ) {
    errors.push(
      context.launchMode === "unknown"
        ? `Unable to determine launch mode. Supported modes: ${manifest.miniApp.launchModes.join(", ")}`
        : `Launch mode '${context.launchMode}' not supported. Supported: ${manifest.miniApp.launchModes.join(", ")}`
    );
  }

  for (const capability of manifest.miniApp.capabilities) {
    const supported = supportsCapability(capability, context);

    if (supported === false) {
      errors.push(`Required capability '${capability}' not available in this context.`);
    } else if (supported === null) {
      errors.push(
        `Required capability '${capability}' cannot be evaluated by @teleforge/core yet.`
      );
    }
  }

  return errors.length === 0 ? { valid: true } : { errors, valid: false };
}

function supportsCapability(capability: string, context: LaunchContext): boolean | null {
  switch (capability) {
    case "inline":
      return context.capabilities.supportsInline;
    case "compact":
      return context.capabilities.supportsCompact;
    case "fullscreen":
      return context.capabilities.supportsFullscreen;
    case "payments":
      return context.capabilities.supportsPayments;
    case "cloudStorage":
    case "cloud_storage":
      return context.capabilities.supportsCloudStorage;
    case "hapticFeedback":
    case "haptic_feedback":
      return context.capabilities.supportsHapticFeedback;
    case "readAccess":
    case "read_access":
      return context.capabilities.supportsReadAccess;
    case "writeAccess":
    case "write_access":
      return context.capabilities.supportsWriteAccess;
    default:
      return null;
  }
}
