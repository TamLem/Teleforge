import type { AppUser, IdentityCacheEntry, ResolvedIdentity } from "../identity/types.js";
import type { LaunchMode, WebAppUser } from "@teleforge/core";

export type BffAuthType = "none" | "session" | "telegram";
export type BffChatType = "channel" | "group" | "private" | "sender" | "supergroup" | null;
export type BffContextErrorCode =
  | "INVALID_INIT_DATA"
  | "MALFORMED_BODY"
  | "MISSING_BOT_ID"
  | "MISSING_REQUIRED_BODY"
  | "MISSING_VALIDATION_CREDENTIALS"
  | "RUNTIME_UNSUPPORTED_VALIDATION";

export interface BffContextOptions {
  botId?: number;
  botToken?: string;
  generateRequestId?: () => string;
  publicKey?: string;
  validateInitData: boolean;
}

export interface CookieOptions {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: "lax" | "none" | "strict";
  secure?: boolean;
  value: string;
}

export interface BffAuthState {
  sessionId: string | null;
  type: BffAuthType;
  user: WebAppUser | null;
}

export interface BffResponseState {
  body: unknown;
  cookies: Map<string, CookieOptions>;
  headers: Headers;
  status: number;
}

export interface BffIdentityState {
  promise: Promise<ResolvedIdentity | null> | null;
  value: ResolvedIdentity | null;
}

export interface BffRequestContext {
  _authState: BffAuthState;
  _identityState: BffIdentityState;
  _resolutionCache: Map<string, IdentityCacheEntry>;
  auth: BffAuthState;
  body: unknown;
  chatInstance: string | null;
  chatType: BffChatType;
  header: (name: string) => string | null;
  headers: Headers;
  id: string;
  identity: ResolvedIdentity | null;
  initDataRaw: string | null;
  json: <T>() => Promise<T>;
  launchMode: LaunchMode;
  method: string;
  path: string;
  response: BffResponseState;
  searchParams: URLSearchParams;
  setHeader: (name: string, value: string) => void;
  setStatus: (code: number) => void;
  startParam: string | null;
  telegramUser: WebAppUser | null;
  text: () => Promise<string>;
  timestamp: number;
  toResponse: () => Response;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

export type { AppUser };
