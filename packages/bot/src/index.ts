/**
 * @packageDocumentation
 * Routing primitives, contexts, and helpers for Telegram bot command and Mini App data handling.
 */
export { createDefaultHelpHandler, createDefaultStartHandler } from "./handlers/commands.js";
export { createWebAppReplyOptions } from "./handlers/webapp.js";
export { createDefaultWebAppDataHandler, parseWebAppPayload } from "./handlers/webapp-data.js";
export {
  createActionCallbackData,
  createFlowCallback,
  createMiniAppButton,
  createMiniAppLaunchButton,
  createMiniAppLaunchUrl,
  createPhoneAuthLink,
  createLocationRequestButton,
  createLocationRequestMarkup,
  createPhoneNumberRequestButton,
  createPhoneNumberRequestMarkup,
  createSignedActionContextToken,
  generateMiniAppLink,
  createSignedPayload,
  extractSharedLocation,
  extractSharedPhoneContact,
  extractFlowContext,
  handleFlowCallback,
  sendFlowInit,
  templates,
  validateActionContext,
  verifyActionCallback
} from "./primitives/index.js";

export type {
  CreateActionCallbackOptions,
  CreateActionContextOptions,
  CreateMiniAppLaunchUrlOptions,
  FlowCallbackData,
  FlowCallbackOptions,
  FlowCallbackSource,
  FlowContext,
  FlowContextSource,
  FlowInitOptions,
  MiniAppLinkOptions,
  FlowResult,
  MessageTemplate,
  MiniAppButtonOptions,
  CreatePhoneAuthLinkOptions,
  LocationRequestButtonOptions,
  LocationRequestMarkupOptions,
  LocationSource,
  PhoneContactSource,
  PhoneNumberRequestButtonOptions,
  PhoneNumberRequestMarkupOptions,
  SharedLocation,
  SharedPhoneContact
} from "./primitives/index.js";
export type { BotRuntime } from "./runtime.js";
export { createBotRuntime } from "./runtime.js";
export { expressAdapter } from "./webhook/adapters/express.js";
export { fastifyAdapter } from "./webhook/adapters/fastify.js";
export { nodeHttpAdapter } from "./webhook/adapters/node.js";
export {
  createWebhookHandler,
  detectUpdateType,
  normalizeHeaders,
  parseWebhookBody
} from "./webhook/handler.js";
export { BotRouter, type BotRouterOptions } from "./router/router.js";
export {
  createCallbackQueryContext,
  createCommandContext,
  createUpdateContext,
  createWebAppContext,
  createWebAppDataContext
} from "./router/context.js";
export type {
  BotCommandDefinition,
  BotInstance,
  CallbackQueryContext,
  CallbackQueryHandler,
  CommandContext,
  CommandHandler,
  CreateBotRuntimeOptions,
  GeneratedCommandResponse,
  ManifestCommandDefinition,
  Middleware,
  NextFunction,
  RegisteredCommand,
  ReplyOptions,
  TelegramCallbackAnswer,
  TelegramChat,
  TelegramCallbackQuery,
  TelegramContact,
  TelegramInlineKeyboardButton,
  TelegramInlineKeyboardMarkup,
  TelegramKeyboardButton,
  TelegramKeyboardMarkup,
  TelegramLocation,
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
export type {
  ExpressLikeRequest,
  ExpressLikeResponse,
  ExpressWebhookHandler,
  FastifyLikeReply,
  FastifyLikeRequest,
  FastifyWebhookHandler,
  WebhookConfig,
  WebhookHandler,
  WebhookRequest,
  WebhookResult,
  WebhookUpdate
} from "./webhook/types.js";
export type { EventPayload, FormPayload, OrderPayload } from "./types/payloads.js";
export { isEventPayload, isFormPayload, isOrderPayload } from "./types/payloads.js";
export { normalizeCommandName, parseCommand, type ParsedCommand } from "./utils/parse.js";
