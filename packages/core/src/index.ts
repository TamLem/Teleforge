/**
 * @packageDocumentation
 * Public server-oriented APIs for Teleforge core manifest loading, launch parsing, validation,
 * and event publishing.
 */
export { ManifestValidationError } from "./errors/ManifestValidationError.js";
export { defineTeleforgeApp, teleforgeAppToManifest } from "./app/types.js";
export { createSignedPhoneAuthToken, verifySignedPhoneAuthToken } from "./auth/phone.js";
export { normalizePhoneNumber } from "./utils/phone.js";
export { EventErrorCodes, TeleforgeEventError } from "./events/errors.js";
export { TeleforgeEventBus, type TeleforgeEventBusOptions } from "./events/bus.js";
export {
  createEventBus,
  getGlobalEventBus,
  resetGlobalEventBus,
  type CreateEventBusOptions
} from "./events/index.js";
export { eventSerializer } from "./events/serializer.js";
export type {
  ApiEventSource,
  BotEventSource,
  EventBus,
  EventHandler,
  EventPayload,
  EventRequestOptions,
  EventType,
  EventSourceInput,
  EmitEventOptions,
  LegacyTeleforgeEventSource,
  MiniAppEventSource,
  SystemEventSource,
  TeleforgeEvent,
  TeleforgeEventInput,
  TeleforgeEventSource,
  TeleforgeEventMap,
  TelemetryCollector
} from "./events/types.js";
export { EventTypes, createEvent, createOrderEvent, normalizeEventSource } from "./events/types.js";
export type { EventErrorCode } from "./events/errors.js";
export type {
  TeleforgeAppConfig,
  TeleforgeFlowConventions,
  TeleforgeAppIdentity,
  TeleforgeMiniAppConfig
} from "./app/types.js";
export type {
  CreateSignedPhoneAuthTokenOptions,
  PhoneAuthTokenPayload,
  VerifySignedPhoneAuthTokenOptions
} from "./auth/phone.js";
export type { ApiEventTransport } from "./events/transports/api.js";
export type { BotEventTransport } from "./events/transports/bot.js";
export type { MiniAppEventTransport } from "./events/transports/miniapp.js";
export {
  SIGNED_FLOW_CONTEXT_PREFIX,
  attachRouteCoordination,
  createSignedFlowContext,
  decodeSignedFlowContext,
  defineCoordinationConfig,
  defineCoordinatedRoute,
  flowCoordination,
  generateMiniAppLink,
  getRouteCoordination,
  inferStateKeyFromFlowContext,
  normalizeRouteCoordination,
  routeCoordination,
  validateCoordinationConfig,
  verifySignedFlowContext
} from "./coordination/index.js";
export type {
  ButtonMapping,
  CommandMapping,
  CoordinationConfig,
  CoordinationDefaults,
  CoordinatedRouteLike,
  DeepLinkMapping,
  FlowDefinition,
  FlowEntry,
  FlowContext,
  LaunchEntryPoint,
  MiniAppLinkFlowOptions,
  MiniAppLinkOptions,
  MiniAppLinkStartPayloadOptions,
  ResolvedCoordinationConfig,
  ResolvedRouteCoordinationConfig,
  ReturnToChatMetadata,
  RouteCoordinationConfig,
  RouteEntry,
  RouteCoordinationMetadata,
  RouteFlowMetadata,
  ValidationError,
  ValidationResult
} from "./coordination/index.js";
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
export { loadManifest, loadManifestFromFile } from "./manifest/load.js";
export { manifestSchema } from "./manifest/schema.js";
export type {
  ManifestValidationIssue,
  ValidateManifestFailure,
  ValidateManifestResult,
  ValidateManifestSuccess
} from "./manifest/validate.js";
export { validateManifest } from "./manifest/validate.js";
export type {
  RouteDefinition,
  TeleforgeManifest,
  TeleforgePermission,
  TeleforgeRouteCapability,
  TeleforgeRuntime
} from "./manifest/types.js";

export type {
  Ed25519ValidationOptions,
  ValidateInitDataFailure,
  ValidateInitDataOptions,
  ValidateInitDataResult,
  ValidateInitDataSuccess
} from "./validation/types.js";
export { validateInitDataBotToken } from "./validation/botToken.js";
export { validateInitDataEd25519 } from "./validation/ed25519.js";
export {
  SessionManager,
  MemorySessionStorageAdapter
} from "./session/index.js";
export type {
  SessionHandle,
  SessionStorageAdapter,
  TeleforgeSession,
  TeleforgeSessionStatus
} from "./session/index.js";
export {
  SIGNED_ACTION_CONTEXT_PREFIX,
  createSignedActionContext,
  decodeActionBase64Url,
  decodeActionContextToken,
  encodeActionBase64Url,
  validateActionContext,
  verifySignedActionContext
} from "./action/index.js";
export type {
  ActionContextToken,
  ActionEffect,
  ActionEffectType,
  ActionResult,
  ActionHandler,
  ActionHandlerContext,
  ActionHandlerDefinition,
  ChatMessageEffect,
  CustomEffect,
  NavigateEffect,
  OpenMiniAppEffect,
  SignActionContextParams,
  SignContextFn,
  WebhookEffect
} from "./action/index.js";
export type {
  ClientFlowManifest,
  ClientFlowManifestEntry,
  ClientScreenManifestEntry
} from "./manifest/client-types.js";
