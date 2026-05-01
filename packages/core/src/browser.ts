/**
 * @packageDocumentation
 * Browser-safe Teleforge core APIs for launch parsing and client-side initData validation.
 */
export { normalizePhoneNumber } from "./utils/phone.js";
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
export {
  defineCoordinationConfig,
  flowCoordination,
  routeCoordination
} from "./coordination/config.js";
export {
  attachRouteCoordination,
  defineCoordinatedRoute,
  getRouteCoordination,
  normalizeRouteCoordination
} from "./coordination/route.js";
export { validateCoordinationConfig } from "./coordination/validate.js";
export type {
  RouteDefinition,
  TeleforgeDeploymentTopology,
  TeleforgeManifest,
  TeleforgePermission,
  TeleforgeRouteCapability,
  TeleforgeRuntime,
  TeleforgeRuntimeEnvironment
} from "./manifest/types.js";
export type {
  ButtonMapping,
  CommandMapping,
  CoordinationConfig,
  CoordinationDefaults,
  DeepLinkMapping,
  FlowDefinition,
  FlowEntry,
  ResolvedCoordinationConfig,
  ResolvedRouteCoordinationConfig,
  RouteCoordinationConfig,
  RouteEntry
} from "./coordination/config.js";
export type {
  CoordinatedRouteLike,
  FlowContext,
  LaunchEntryPoint,
  ReturnToChatMetadata,
  RouteCoordinationMetadata,
  RouteFlowMetadata
} from "./coordination/types.js";
export type { ValidationError, ValidationResult } from "./coordination/validate.js";

export type { ActionContextToken, ActionResult } from "./action/index.js";
export type {
  ClientFlowManifest,
  ClientFlowManifestEntry,
  ClientScreenManifestEntry
} from "./manifest/client-types.js";
export type {
  Ed25519ValidationOptions,
  ValidateInitDataFailure,
  ValidateInitDataOptions,
  ValidateInitDataResult,
  ValidateInitDataSuccess
} from "./validation/types.js";
export { validateInitDataEd25519 } from "./validation/ed25519.js";
