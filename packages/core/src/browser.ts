/**
 * @packageDocumentation
 * Browser-safe Teleforge core APIs for launch parsing and client-side initData validation.
 */
export { detectCapabilities, detectLaunchMode } from "./launch/detector.js";
export { parseInitData, parseInitDataUnsafe } from "./launch/initData.js";
export { parseLaunchContext } from "./launch/parser.js";
export type {
  DetectCapabilitiesOptions,
  LaunchCapabilities,
  LaunchContext,
  LaunchMode,
  ParseInitDataFailure,
  ParseInitDataResult,
  ParseInitDataSuccess,
  ValidateLaunchFailure,
  ValidateLaunchOptions,
  ValidateLaunchResult,
  ValidateLaunchSuccess,
  WebAppChat,
  WebAppInitData,
  WebAppUser
} from "./launch/types.js";
export { validateLaunchAgainstManifest } from "./launch/validator.js";
export type {
  RouteDefinition,
  TeleforgeManifest,
  TeleforgePermission,
  TeleforgeRouteCapability,
  TeleforgeRuntime
} from "./manifest/types.js";
export type { FlowStateResolver, ResumeFlowError, ResumeFlowResult } from "./storage/resume.js";
export type { UserFlowState } from "./storage/types.js";
export type {
  Ed25519ValidationOptions,
  ValidateInitDataFailure,
  ValidateInitDataOptions,
  ValidateInitDataResult,
  ValidateInitDataSuccess
} from "./validation/types.js";
export { validateInitDataEd25519 } from "./validation/ed25519.js";
