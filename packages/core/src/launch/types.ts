import type { TeleforgeManifest } from "../manifest/types.js";
import type { TelegramPlatform } from "../utils/platform.js";

export type LaunchMode = "inline" | "compact" | "fullscreen" | "unknown";

export interface WebAppUser {
  added_to_attachment_menu?: boolean;
  allows_write_to_pm?: boolean;
  first_name: string;
  id: number;
  is_bot?: boolean;
  is_premium?: boolean;
  language_code?: string;
  last_name?: string;
  photo_url?: string;
  username?: string;
}

export interface WebAppChat {
  id: number;
  photo_url?: string;
  title: string;
  type: string;
  username?: string;
}

export interface WebAppInitData {
  auth_date?: number;
  can_send_after?: number;
  chat?: WebAppChat;
  chat_instance?: string;
  chat_type?: string;
  hash?: string;
  query_id?: string;
  receiver?: WebAppUser;
  start_param?: string;
  user?: WebAppUser;
}

export interface LaunchCapabilities {
  supported: string[];
  supportsCloudStorage: boolean;
  supportsCompact: boolean;
  supportsFullscreen: boolean;
  supportsHapticFeedback: boolean;
  supportsInline: boolean;
  supportsPayments: boolean;
  supportsReadAccess: boolean;
  supportsWriteAccess: boolean;
}

export interface LaunchContext {
  authDate: Date | null;
  canExpand: boolean;
  capabilities: LaunchCapabilities;
  hash: string;
  initData: string;
  initDataUnsafe: WebAppInitData;
  isCompact: boolean;
  isFullscreen: boolean;
  isInline: boolean;
  launchMode: LaunchMode;
  mode: LaunchMode;
  platform: TelegramPlatform;
  startParam: string | null;
  startParamRaw: string | null;
  user: WebAppUser | null;
  userUnsafe: WebAppUser | null;
  version: string;
}

export interface ParseInitDataSuccess {
  data: WebAppInitData;
  success: true;
}

export interface ParseInitDataFailure {
  error: string;
  success: false;
}

export type ParseInitDataResult = ParseInitDataFailure | ParseInitDataSuccess;

export interface ValidateLaunchSuccess {
  valid: true;
}

export interface ValidateLaunchFailure {
  errors: string[];
  valid: false;
}

export type ValidateLaunchResult = ValidateLaunchFailure | ValidateLaunchSuccess;

export interface DetectCapabilitiesOptions {
  initDataUnsafe?: WebAppInitData;
  launchMode?: LaunchMode;
  platform: TelegramPlatform;
  version: string;
}

export interface ValidateLaunchOptions {
  manifest: TeleforgeManifest;
  context: LaunchContext;
}
