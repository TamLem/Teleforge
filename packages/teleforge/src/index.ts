export {
  defineTeleforgeApp,
  teleforgeAppToManifest,
  type TeleforgeAppConfig,
  type TeleforgeAppIdentity,
  type TeleforgeMiniAppConfig
} from "@teleforgex/core";

export type {
  RouteDefinition,
  TeleforgePermission,
  TeleforgeRouteCapability,
  TeleforgeRuntime
} from "@teleforgex/core";

export {
  defineFlow,
  resolveFlowAction
} from "./flow-definition.js";

export type {
  ActionFlowActionDefinition,
  ActionFlowActionHandlerContext,
  ActionFlowCallbackHandlerContext,
  ActionFlowCommandDefinition,
  ActionFlowCommandHandlerContext,
  ActionFlowContactHandlerContext,
  ActionFlowDefinition,
  ActionFlowDefinitionInput,
  ActionFlowHandlers,
  ActionFlowLocationHandlerContext,
  ActionFlowMiniAppDefinition,
  ActionFlowSessionDefinition,
  ActionFlowWebAppDataHandlerContext,
  SharedLocation,
  SharedPhoneContact
} from "./flow-definition.js";

export { createClientFlowManifest, defineClientFlowManifest } from "./flow-manifest.js";
export type { TeleforgeClientFlowManifest } from "./flow-manifest.js";

export {
  createDiscoveredBotRuntime,
  createTeleforgeWebhookHandler,
  startTeleforgeBot
} from "./bot-runtime.js";
export type {
  CreateDiscoveredBotRuntimeOptions,
  CreateTeleforgeWebhookHandlerOptions,
  DiscoveredBotRuntime,
  StartTeleforgeBotOptions,
  StartTeleforgeBotResult
} from "./bot-runtime.js";

export {
  createTeleforgeRuntimeContext
} from "./runtime-context.js";
export type {
  CreateTeleforgeRuntimeContextOptions,
  TeleforgeRuntimeContext
} from "./runtime-context.js";

export {
  TeleforgeMiniApp,
  MiniAppStateProvider,
  useAppState
} from "./miniapp-runtime.js";

export {
  createActionServerHooksHandler,
  createFetchMiniAppServerBridge,
  DEFAULT_SERVER_HOOKS_PATH,
  startTeleforgeServer
} from "./server-hooks.js";

export type {
  ActionServerHookTrustContext,
  ActionServerHookTrustOptions,
  CreateActionServerHooksHandlerOptions,
  StartTeleforgeServerOptions,
  StartTeleforgeServerResult
} from "./server-hooks.js";

export {
  createFlowCommands,
  createFlowCoordinationConfigFromFlows,
  createFlowRoutes,
  createFlowRuntimeSummaries,
  createFlowRuntimeSummary,
  discoverFlowFiles,
  discoverScreenFiles,
  loadActionRegistry,
  loadRouteRegistry,
  loadTeleforgeFlows,
  loadTeleforgeScreens,
  resolveFlowServerHooksRoot,
  resolveScreenRoot
} from "./discovery.js";

export type {
  CreateFlowCommandsOptions,
  CreateFlowRoutesOptions,
  CreateFlowRuntimeSummaryOptions,
  DiscoveredFlowModule,
  DiscoveredFlowActionSummary,
  DiscoveredFlowRuntimeSummary,
  DiscoveredFlowStepHandlerModule,
  DiscoveredFlowStepServerHookModule,
  DiscoverFlowFilesOptions,
  DiscoverScreenFilesOptions,
  LoadTeleforgeFlowsOptions,
  LoadTeleforgeScreensOptions,
  TeleforgeFlowConventions
} from "./discovery.js";

export {
  loadTeleforgeApp,
  loadTeleforgeAppFromFile,
  resolveTeleforgeConfigPath
} from "./config.js";
export type { LoadedTeleforgeApp } from "./config.js";

export { createScreenRegistry, defineScreen, findRoutePattern, resolveMiniAppScreen } from "./screens.js";
export type {
  DiscoveredScreenModule,
  ResolvedMiniAppScreen,
  TeleforgeScreenComponentProps,
  TeleforgeScreenDefinition,
  TeleforgeScreenGuardBlock,
  TeleforgeScreenGuardResult,
  TeleforgeScreenRuntimeContext,
  UnresolvedMiniAppScreen
} from "./screens.js";

export type {
  CreateFetchMiniAppServerBridgeOptions,
  TeleforgeActionServerBridge,
  TeleforgeActionServerHandoffInput,
  TeleforgeActionServerLoadInput,
  TeleforgeActionServerLoadResult,
  TeleforgeActionServerRunActionInput
} from "./server-bridge.js";
