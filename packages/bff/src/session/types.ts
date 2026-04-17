import type { BffErrorCode } from "../errors/codes.js";
import type { SessionSecurityEventSink } from "../events/security.js";
import type {
  AppUser,
  IdentityResolutionOptions,
  PhoneAuthOptions,
  ResolvedIdentity
} from "../identity/types.js";

export type BffSessionErrorCode = Extract<
  BffErrorCode,
  | "REFRESH_TOKEN_INVALID"
  | "REFRESH_TOKEN_REUSED"
  | "SESSION_REVOKED"
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID"
>;

export interface RefreshTokenRecord {
  expiresAt: number;
  familyId: string;
  hash: string;
  issuedAt: number;
  replacedBy: string | null;
  sequence: number;
  usedAt: number | null;
}

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
  refreshTokenFamilyId?: string;
  refreshTokenExpiresAt: number;
  refreshTokenHash: string;
  refreshTokenIssuedAt?: number;
  telegramUserId: number;
  userId: string;
}

export interface SessionRecord {
  createdAt: number;
  compromisedAt: number | null;
  deviceInfo?: Record<string, unknown>;
  id: string;
  refreshTokenFamilyId: string;
  refreshTokenExpiresAt: number;
  refreshTokenHash: string;
  refreshTokenSequence: number;
  refreshTokens: Record<string, RefreshTokenRecord>;
  revokedAt: number | null;
  telegramUserId: number;
  updatedAt: number;
  userId: string;
}

export interface RotateRefreshTokenInput {
  currentRefreshTokenHash: string;
  nextRefreshTokenExpiresAt: number;
  nextRefreshTokenHash: string;
  rotatedAt: number;
}

export type RotateRefreshTokenResult =
  | {
      previousToken: RefreshTokenRecord;
      session: SessionRecord;
      status: "rotated";
    }
  | {
      detectedAt: number;
      familyId: string;
      session: SessionRecord;
      status: "reused";
      token: RefreshTokenRecord;
    }
  | {
      session: SessionRecord;
      status: "invalid";
    };

export interface SessionAdapter {
  createSession: (input: CreateSessionInput) => Promise<SessionRecord> | SessionRecord;
  getSession: (sessionId: string) => Promise<SessionRecord | null> | SessionRecord | null;
  revokeAllUserSessions: (userId: string) => Promise<void> | void;
  revokeSession: (sessionId: string) => Promise<void> | void;
  revokeTokenFamily: (familyId: string) => Promise<void> | void;
  rotateRefreshToken: (
    sessionId: string,
    input: RotateRefreshTokenInput
  ) => Promise<RotateRefreshTokenResult> | RotateRefreshTokenResult;
}

export interface SessionConfig {
  accessTokenTtlSeconds?: number;
  adapter: SessionAdapter;
  refreshTokenTtlSeconds?: number;
  securityEvents?: SessionSecurityEventSink | null;
  secret: string;
}

export interface SessionValidationOptions extends SessionConfig {
  refreshWindow?: number;
  required: boolean;
}

export interface ExchangeInput {
  deviceInfo?: Record<string, unknown>;
}

export interface PhoneAuthExchangeInput extends ExchangeInput {
  phoneAuthToken: string;
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

export interface PhoneAuthRouteOptions<TAppUser extends AppUser = AppUser> extends SessionConfig {
  identity: PhoneAuthOptions<TAppUser>;
}
