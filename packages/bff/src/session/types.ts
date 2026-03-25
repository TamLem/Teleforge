import type { BffErrorCode } from "../errors/codes.js";
import type { AppUser, IdentityResolutionOptions, ResolvedIdentity } from "../identity/types.js";

export type BffSessionErrorCode = Extract<
  BffErrorCode,
  "REFRESH_TOKEN_INVALID" | "SESSION_REVOKED" | "TOKEN_EXPIRED" | "TOKEN_INVALID"
>;

export interface SessionClaims {
  exp: number;
  iat: number;
  sid: string;
  sub: string;
  tid: number;
  type: "access";
}

export interface CreateSessionInput {
  deviceInfo?: Record<string, unknown>;
  id: string;
  refreshTokenExpiresAt: number;
  refreshTokenHash: string;
  telegramUserId: number;
  userId: string;
}

export interface SessionRecord {
  createdAt: number;
  deviceInfo?: Record<string, unknown>;
  id: string;
  refreshTokenExpiresAt: number;
  refreshTokenHash: string;
  revokedAt: number | null;
  telegramUserId: number;
  updatedAt: number;
  userId: string;
}

export interface SessionAdapter {
  createSession: (input: CreateSessionInput) => Promise<SessionRecord> | SessionRecord;
  getSession: (sessionId: string) => Promise<SessionRecord | null> | SessionRecord | null;
  revokeAllUserSessions: (userId: string) => Promise<void> | void;
  revokeSession: (sessionId: string) => Promise<void> | void;
  rotateRefreshToken: (
    sessionId: string,
    refreshTokenHash: string,
    refreshTokenExpiresAt: number
  ) => Promise<SessionRecord> | SessionRecord;
}

export interface SessionConfig {
  accessTokenTtlSeconds?: number;
  adapter: SessionAdapter;
  refreshTokenTtlSeconds?: number;
  secret: string;
}

export interface SessionValidationOptions extends SessionConfig {
  refreshWindow?: number;
  required: boolean;
}

export interface ExchangeInput {
  deviceInfo?: Record<string, unknown>;
}

export interface ExchangeOutput<TAppUser extends AppUser = AppUser> {
  accessToken: string;
  expiresIn: number;
  identity: ResolvedIdentity<TAppUser>;
  refreshToken: string;
}

export interface RefreshInput {
  refreshToken: string;
}

export interface RevokeInput {
  all?: boolean;
}

export interface RevokeOutput {
  revoked: boolean;
  sessionId: string | null;
}

export interface SessionRouteOptions<TAppUser extends AppUser = AppUser> extends SessionConfig {
  identity: IdentityResolutionOptions<TAppUser>;
}
