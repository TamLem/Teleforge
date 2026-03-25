/**
 * @packageDocumentation
 * Routing primitives, contexts, and helpers for Telegram bot command and Mini App data handling.
 */
export { createDefaultHelpHandler, createDefaultStartHandler } from "./handlers/commands.js";
export { createWebAppReplyOptions } from "./handlers/webapp.js";
export { createDefaultWebAppDataHandler, parseWebAppPayload } from "./handlers/webapp-data.js";
export { handleMiniAppReturn, initiateCoordinatedFlow } from "./coordination/state-bridge.js";
export {
  createFlowCallback,
  createMiniAppButton,
  createSignedPayload,
  extractFlowContext,
  handleFlowCallback,
  sendFlowInit,
  templates
} from "./primitives/index.js";
export type { CoordinatedFlowOptions } from "./coordination/state-bridge.js";
export type {
  FlowCallbackData,
  FlowCallbackOptions,
  FlowCallbackSource,
  FlowContext,
  FlowContextSource,
  FlowInitOptions,
  FlowResult,
  MessageTemplate,
  MiniAppButtonOptions
} from "./primitives/index.js";
export type { BotRuntime } from "./runtime.js";
export { createBotRuntime } from "./runtime.js";
export { BotRouter, type BotRouterOptions } from "./router/router.js";
export {
  createCommandContext,
  createUpdateContext,
  createWebAppContext,
  createWebAppDataContext
} from "./router/context.js";
export type {
  BotCommandDefinition,
  BotInstance,
  CommandContext,
  CommandHandler,
  CreateBotRuntimeOptions,
  GeneratedCommandResponse,
  ManifestCommandDefinition,
  Middleware,
  NextFunction,
  RegisteredCommand,
  ReplyOptions,
  TelegramChat,
  TelegramCallbackQuery,
  TelegramInlineKeyboardButton,
  TelegramMessage,
  TelegramReplyMarkup,
  TelegramUpdate,
  TelegramUser,
  TelegramWebAppData,
  UpdateContext,
  WebAppContext,
  WebAppDataContext,
  WebAppDataHandler,
  WebAppHandler
} from "./router/types.js";
export type { EventPayload, FormPayload, OrderPayload } from "./types/payloads.js";
export { isEventPayload, isFormPayload, isOrderPayload } from "./types/payloads.js";
export { normalizeCommandName, parseCommand, type ParsedCommand } from "./utils/parse.js";
