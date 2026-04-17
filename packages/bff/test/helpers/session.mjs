import { generateKeyPairSync, sign } from "node:crypto";

import { createBffRequestContext } from "../../dist/index.js";

export function createMemorySessionAdapter() {
  const sessions = new Map();

  return {
    async createSession(input) {
      const issuedAt = input.refreshTokenIssuedAt ?? Date.now();
      const refreshTokenFamilyId = input.refreshTokenFamilyId ?? input.id;
      const refreshToken = createRefreshTokenRecord({
        expiresAt: input.refreshTokenExpiresAt,
        familyId: refreshTokenFamilyId,
        hash: input.refreshTokenHash,
        issuedAt,
        sequence: 0
      });
      const record = {
        compromisedAt: null,
        createdAt: issuedAt,
        id: input.id,
        refreshTokenFamilyId,
        refreshTokenExpiresAt: input.refreshTokenExpiresAt,
        refreshTokenHash: input.refreshTokenHash,
        refreshTokenSequence: refreshToken.sequence,
        refreshTokens: {
          [refreshToken.hash]: refreshToken
        },
        revokedAt: null,
        telegramUserId: input.telegramUserId,
        updatedAt: issuedAt,
        userId: input.userId,
        ...(input.deviceInfo ? { deviceInfo: input.deviceInfo } : {})
      };

      sessions.set(record.id, record);

      return record;
    },
    async getSession(sessionId) {
      return sessions.get(sessionId) ?? null;
    },
    async revokeAllUserSessions(userId) {
      for (const session of sessions.values()) {
        if (session.userId === userId) {
          session.revokedAt = Date.now();
          session.updatedAt = Date.now();
        }
      }
    },
    async revokeSession(sessionId) {
      const session = sessions.get(sessionId);

      if (session) {
        session.revokedAt = Date.now();
        session.updatedAt = Date.now();
      }
    },
    async revokeTokenFamily(familyId) {
      for (const session of sessions.values()) {
        if (session.refreshTokenFamilyId === familyId) {
          session.compromisedAt = Date.now();
          session.revokedAt = Date.now();
          session.updatedAt = Date.now();
        }
      }
    },
    async rotateRefreshToken(sessionId, input) {
      const session = sessions.get(sessionId);

      if (!session) {
        throw new Error(`Missing session ${sessionId}`);
      }

      const currentToken = session.refreshTokens[input.currentRefreshTokenHash];

      if (!currentToken) {
        return {
          session,
          status: "invalid"
        };
      }

      if (currentToken.usedAt !== null) {
        return {
          detectedAt: input.rotatedAt,
          familyId: session.refreshTokenFamilyId,
          session,
          status: "reused",
          token: currentToken
        };
      }

      currentToken.replacedBy = input.nextRefreshTokenHash;
      currentToken.usedAt = input.rotatedAt;

      const nextToken = createRefreshTokenRecord({
        expiresAt: input.nextRefreshTokenExpiresAt,
        familyId: session.refreshTokenFamilyId,
        hash: input.nextRefreshTokenHash,
        issuedAt: input.rotatedAt,
        sequence: currentToken.sequence + 1
      });

      session.refreshTokenExpiresAt = input.nextRefreshTokenExpiresAt;
      session.refreshTokenHash = input.nextRefreshTokenHash;
      session.refreshTokenSequence = nextToken.sequence;
      session.refreshTokens[nextToken.hash] = nextToken;
      session.updatedAt = input.rotatedAt;

      return {
        previousToken: currentToken,
        session,
        status: "rotated"
      };
    },
    sessions
  };
}

function createRefreshTokenRecord({ expiresAt, familyId, hash, issuedAt, sequence }) {
  return {
    expiresAt,
    familyId,
    hash,
    issuedAt,
    replacedBy: null,
    sequence,
    usedAt: null
  };
}

export function createIdentityAdapter(overrides = {}) {
  return {
    async create(user) {
      return {
        id: "user_created",
        ...user
      };
    },
    async findByPhoneNumber(phoneNumber) {
      return phoneNumber
        ? {
            id: `app_user:phone:${phoneNumber}`,
            phoneNumber
          }
        : null;
    },
    async findByTelegramId(telegramUserId) {
      return {
        id: "app_user_1",
        telegramUserId
      };
    },
    async findByUsername(username) {
      return username
        ? {
            id: `app_user:${username}`,
            username
          }
        : null;
    },
    async update(appUserId, updates) {
      return {
        id: appUserId,
        ...updates
      };
    },
    ...overrides
  };
}

export async function createAuthenticatedTelegramContext(
  url = "https://example.com/bff/session/exchange"
) {
  const vector = createEd25519SampleVector();

  return await createBffRequestContext(
    new Request(url, {
      headers: {
        "x-telegram-init-data": vector.initData
      },
      method: "POST"
    }),
    {
      botId: vector.botId,
      publicKey: vector.publicKeyHex,
      validateInitData: true
    }
  );
}

export async function createSessionRequestContext(
  accessToken,
  url = "https://example.com/api/session"
) {
  return await createBffRequestContext(
    new Request(url, {
      headers: accessToken
        ? {
            authorization: `Bearer ${accessToken}`
          }
        : undefined,
      method: "POST"
    }),
    {
      validateInitData: false
    }
  );
}

function createEd25519SampleVector() {
  const authDate = Math.floor(Date.now() / 1000);
  const botId = 12_345_678;
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const params = new URLSearchParams();

  params.set("auth_date", String(authDate));
  params.set("query_id", "AAHdF6IQAAAAAN0XohDhrOrc");
  params.set(
    "user",
    JSON.stringify({
      first_name: "Integration",
      id: 279058397,
      username: "integration_user"
    })
  );

  const dataCheckString = [
    `${botId}:WebAppData`,
    ...[...params.entries()].map(([key, value]) => `${key}=${value}`).sort()
  ].join("\n");
  const signature = sign(null, Buffer.from(dataCheckString), privateKey)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  params.set("signature", signature);

  const publicKeyDer = publicKey.export({
    format: "der",
    type: "spki"
  });

  return {
    botId,
    initData: params.toString(),
    publicKeyHex: publicKeyDer.subarray(12).toString("hex")
  };
}
