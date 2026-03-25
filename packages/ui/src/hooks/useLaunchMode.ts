import { useLaunch } from "@teleforge/web";

export type LaunchMode = "inline" | "compact" | "fullscreen";

export interface UseLaunchModeReturn {
  canRender: (modes: LaunchMode[]) => boolean;
  isCompact: boolean;
  isFullscreen: boolean;
  isInline: boolean;
  mode: LaunchMode | null;
}

export function useLaunchMode(): UseLaunchModeReturn {
  const { mode: launchMode } = useLaunch();
  const mode = normalizeMode(launchMode);

  return {
    canRender(modes) {
      return mode !== null && modes.includes(mode);
    },
    isCompact: mode === "compact",
    isFullscreen: mode === "fullscreen",
    isInline: mode === "inline",
    mode
  };
}

function normalizeMode(mode: ReturnType<typeof useLaunch>["mode"]): LaunchMode | null {
  if (mode === "inline" || mode === "compact" || mode === "fullscreen") {
    return mode;
  }

  return null;
}
