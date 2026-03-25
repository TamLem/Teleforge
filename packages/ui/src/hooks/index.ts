/**
 * @packageDocumentation
 * Convenience re-exports that combine `@teleforge/web` hooks with UI-specific helpers.
 */
export {
  useMainButton,
  useTelegram,
  useTheme,
  type MainButtonOptions,
  type UseMainButtonReturn,
  type UseTelegramReturn,
  type UseThemeReturn
} from "@teleforge/web";
export { useLaunchMode, type LaunchMode, type UseLaunchModeReturn } from "./useLaunchMode.js";
export { useThemeColors, type ThemeColors } from "./useThemeColors.js";
