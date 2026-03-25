import type { TeleforgeManifest } from "@teleforge/core";

export interface TelegramChat {
  id: number | string;
  title?: string;
  type?: string;
  username?: string;
}

export interface TelegramUser {
  first_name: string;
  id: number;
  is_bot?: boolean;
  language_code?: string;
  last_name?: string;
  username?: string;
}

export interface TelegramWebAppData {
  button_text?: string;
  data: string;
}

export interface TelegramCallbackQuery {
  data?: string;
  from: TelegramUser;
  id?: string;
  message?: TelegramMessage;
}

export interface TelegramInlineKeyboardButton {
  callback_data?: string;
  text: string;
  url?: string;
  web_app?: {
    url: string;
  };
}

export interface TelegramReplyMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface ReplyOptions {
  disable_web_page_preview?: boolean;
  parse_mode?: string;
  reply_to_message_id?: number;
  reply_markup?: TelegramReplyMarkup;
}

export interface TelegramMessage {
  chat: TelegramChat;
  date?: number;
  from?: TelegramUser;
  message_id?: number;
  text?: string;
  web_app_data?: TelegramWebAppData;
}

export interface TelegramUpdate {
  callback_query?: TelegramCallbackQuery;
  edited_message?: TelegramMessage;
  message?: TelegramMessage;
  update_id?: number;
}

export interface BotInstance {
  sendMessage(
    chatId: TelegramChat["id"],
    text: string,
    options?: ReplyOptions
  ): Promise<TelegramMessage>;
}

export interface UpdateContext {
  bot: BotInstance | null;
  chat: TelegramChat | null;
  message: TelegramMessage | null;
  reply: (text: string, options?: ReplyOptions) => Promise<TelegramMessage>;
  replyWithWebApp: (text: string, buttonText: string, url: string) => Promise<TelegramMessage>;
  state: Record<string, unknown>;
  update: TelegramUpdate;
  user: TelegramUser | null;
}

export interface CommandContext extends UpdateContext {
  args: string[];
  chat: TelegramChat;
  command: string;
  message: TelegramMessage;
  user: TelegramUser;
}

export interface WebAppContext extends UpdateContext {
  buttonText: string | null;
  chat: TelegramChat;
  data: string;
  message: TelegramMessage;
  user: TelegramUser | null;
}

export interface WebAppDataContext extends UpdateContext {
  answer: (text: string) => Promise<TelegramMessage>;
  chat: TelegramChat;
  data: string;
  message: TelegramMessage;
  messageId: number | null;
  payload: unknown | null;
  timestamp: number | null;
  user: TelegramUser | null;
}

export type CommandHandler = (ctx: CommandContext) => Promise<void> | void;
export type WebAppHandler = (ctx: WebAppContext) => Promise<void> | void;
export type WebAppDataHandler = (ctx: WebAppDataContext) => Promise<void> | void;
export type NextFunction = () => Promise<void>;
export type Middleware = (ctx: UpdateContext, next: NextFunction) => Promise<void> | void;

export interface GeneratedCommandResponse {
  options?: ReplyOptions;
  text: string;
  webApp?: {
    buttonText: string;
    url: string;
  };
}

export interface BotCommandDefinition {
  command: string;
  description?: string;
  handler:
    | CommandHandler
    | ((
        ctx: CommandContext
      ) => Promise<GeneratedCommandResponse | void> | GeneratedCommandResponse | void);
}

export interface ManifestCommandDefinition {
  command: string;
  description?: string;
  handler?: string;
}

export interface RegisteredCommand {
  command: string;
  description?: string;
  handlerPath?: string;
  source: "manifest" | "runtime";
}

export interface CreateBotRuntimeOptions {
  bot?: BotInstance;
  manifest?: TeleforgeManifest;
}
