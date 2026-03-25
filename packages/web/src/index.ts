/**
 * @packageDocumentation
 * React hooks and guard components for working with Telegram Mini Apps in the browser.
 */
export { CapabilityGuard } from "./guards/CapabilityGuard.js";
export {
  cancelFlow,
  completeFlow,
  returnToChat,
  type ReturnToChatOptions
} from "./coordination/return.js";
export { CoordinationProvider, type CoordinationProviderProps } from "./coordination/provider.js";
export type { CoordinationNavigateOptions, PersistFlowStateInput } from "./coordination/context.js";
export {
  useFlowCoordination,
  useFlowNavigation,
  useLaunchCoordination,
  useReturnToChat,
  type NavigateToRouteOptions,
  type NavigateToStepOptions,
  type ReturnToChatHookOptions,
  type UseFlowCoordinationReturn,
  type UseFlowNavigationReturn,
  type UseLaunchCoordinationReturn,
  type UseReturnToChatReturn
} from "./coordination/hooks.js";
export { ExpiredFlowView, type ExpiredFlowViewProps } from "./flow/ExpiredFlowView.js";
export { FlowResumeProvider, type FlowResumeProviderProps } from "./flow/FlowResumeProvider.js";
export { ResumeIndicator, type ResumeIndicatorProps } from "./flow/ResumeIndicator.js";
export { parseResumeParam } from "./flow/parseResumeParam.js";
export { resumeFlow, type ResumeFlowOptions } from "./flow/resumeFlow.js";
export { useFlowState } from "./flow/useFlowState.js";
export type {
  FlowStateCommitOptions,
  FlowStateContextValue,
  FlowStateStatus
} from "./flow/context.js";
export {
  transmitResult,
  type TransmitConfig,
  type TransmitResult
} from "./coordination/transmit.js";
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
  useCoordinatedMainButton,
  useMainButton,
  type CoordinatedMainButtonOptions,
  type MainButtonOptions,
  type UseCoordinatedMainButtonReturn,
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
