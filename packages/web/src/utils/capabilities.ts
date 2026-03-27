import type { LaunchCapabilities, LaunchContext } from "@teleforgex/core/browser";

export function hasCapability(
  capability: string,
  input: {
    capabilities: LaunchCapabilities;
    context: LaunchContext | null;
  }
): boolean {
  const normalized = capability.trim();

  switch (normalized) {
    case "payments":
      return input.capabilities.supportsPayments;
    case "cloudStorage":
    case "cloud_storage":
      return input.capabilities.supportsCloudStorage;
    case "haptic":
    case "hapticFeedback":
    case "haptic_feedback":
      return input.capabilities.supportsHapticFeedback;
    case "expand":
      return input.context?.canExpand ?? false;
    case "readAccess":
    case "read_access":
      return input.capabilities.supportsReadAccess;
    case "writeAccess":
    case "write_access":
      return input.capabilities.supportsWriteAccess;
    case "inline":
      return input.capabilities.supportsInline;
    case "compact":
      return input.capabilities.supportsCompact;
    case "fullscreen":
      return input.capabilities.supportsFullscreen;
    default:
      return input.capabilities.supported.includes(normalized);
  }
}
