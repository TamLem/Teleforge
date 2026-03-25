/**
 * @packageDocumentation
 * React hooks and guard components for working with Telegram Mini Apps in the browser.
 */
export { CapabilityGuard } from "./guards/CapabilityGuard.js";
export {
  ManifestProvider,
  type ManifestProviderProps,
  useManifest
} from "./guards/ManifestContext.js";
export type { CapabilityGuardProps, GuardResult, RouteRequirements } from "./guards/types.js";
export { useManifestGuard } from "./guards/useManifestGuard.js";
export { useRouteGuard } from "./guards/useRouteGuard.js";
export { withRouteGuard, type WithRouteGuardOptions } from "./guards/withRouteGuard.js";
export { useTelegram, type UseTelegramReturn } from "./hooks/useTelegram.js";
export { useLaunch, type UseLaunchCapabilities, type UseLaunchReturn } from "./hooks/useLaunch.js";
export {
  useMainButton,
  type MainButtonOptions,
  type UseMainButtonReturn
} from "./hooks/useMainButton.js";
export { useTheme, type UseThemeReturn } from "./hooks/useTheme.js";
export type {
  CloudStorage,
  HapticFeedback,
  MainButton,
  MainButtonParams,
  PopupButton,
  PopupParams,
  TelegramPlatform,
  TelegramWebApp,
  ThemeParams,
  WebAppColorScheme,
  WebAppEvent,
  WebAppInitData,
  WebAppUser
} from "./types/webapp.js";
