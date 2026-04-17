import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import {
  createBffRequestContext,
  customIdentityProvider,
  resolveIdentity,
  telegramIdIdentityProvider,
  usernameIdentityProvider
} from "../../dist/index.js";

test("resolveIdentity returns an existing user via telegram-id provider and reuses the request cache", async () => {
  const context = await createAuthenticatedContext();
  let lookupCount = 0;
  const adapter = createAdapter({
    findByTelegramId: async (telegramUserId) => {
      lookupCount += 1;

      return {
        id: "user_1",
        telegramUserId
      };
    }
  });

  const first = await resolveIdentity(context, {
    adapter,
    autoCreate: false,
    providers: [telegramIdIdentityProvider()]
  });
  const second = await resolveIdentity(context, {
    adapter,
    autoCreate: false,
    providers: [telegramIdIdentityProvider()]
  });

  assert.equal(first?.appUserId, "user_1");
  assert.equal(first?.isNewUser, false);
  assert.equal(second?.appUserId, "user_1");
  assert.equal(lookupCount, 1);
  assert.equal(context.identity?.appUserId, "user_1");
});

test("resolveIdentity auto-creates new users and applies onCreate fields", async () => {
  const context = await createAuthenticatedContext();
  let createCount = 0;
  const adapter = createAdapter({
    create: async (user) => {
      createCount += 1;

      return {
        id: "user_new",
        ...user
      };
    }
  });

  const identity = await resolveIdentity(context, {
    adapter,
    autoCreate: true,
    onCreate(telegramUser) {
      return {
        credits: 100,
        displayName: telegramUser.first_name
      };
    },
    providers: [telegramIdIdentityProvider()]
  });

  assert.equal(identity?.appUserId, "user_new");
  assert.equal(identity?.isNewUser, true);
  assert.equal(identity?.appUser?.credits, 100);
  assert.equal(identity?.appUser?.displayName, "Integration");
  assert.equal(createCount, 1);
});

test("resolveIdentity returns a null app identity when autoCreate is disabled", async () => {
  const context = await createAuthenticatedContext();
  const adapter = createAdapter();

  const identity = await resolveIdentity(context, {
    adapter,
    autoCreate: false,
    providers: [telegramIdIdentityProvider()]
  });

  assert.equal(identity?.appUserId, null);
  assert.equal(identity?.appUser, null);
  assert.equal(identity?.isNewUser, false);
});

test("resolveIdentity supports username providers", async () => {
  const context = await createAuthenticatedContext();
  const adapter = createAdapter({
    findByUsername: async (username) => ({
      id: `user:${username}`,
      username
    })
  });

  const identity = await resolveIdentity(context, {
    adapter,
    autoCreate: false,
    providers: [usernameIdentityProvider()]
  });

  assert.equal(identity?.appUserId, "user:integration_user");
  assert.equal(identity?.appUser?.username, "integration_user");
});

test("resolveIdentity supports custom providers", async () => {
  const context = await createAuthenticatedContext();
  let lookupCount = 0;

  const identity = await resolveIdentity(context, {
    adapter: createAdapter(),
    autoCreate: false,
    providers: [
      customIdentityProvider(async ({ telegramUser }) => {
        lookupCount += 1;

        return {
          appUser: {
            id: `custom:${telegramUser.id}`
          }
        };
      })
    ]
  });

  assert.equal(identity?.appUserId, "custom:279058397");
  assert.equal(lookupCount, 1);
});

function createAdapter(overrides = {}) {
  return {
    async create(user) {
      return {
        id: "user_created",
        ...user
      };
    },
    async findByTelegramId() {
      return null;
    },
    async findByUsername() {
      return null;
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

async function createAuthenticatedContext() {
  const vector = createEd25519SampleVector();

  return await createBffRequestContext(
    new Request("https://example.com/api/identity", {
      headers: {
        "x-telegram-init-data": vector.initData
      }
    }),
    {
      botId: vector.botId,
      publicKey: vector.publicKeyHex,
      validateInitData: true
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
