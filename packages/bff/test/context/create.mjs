import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync, sign } from "node:crypto";

import { BffContextError, createBffRequestContext } from "../../dist/index.js";

test("createBffRequestContext populates telegram auth from valid Ed25519 initData", async () => {
  const vector = createEd25519SampleVector({
    startParam: "flow_abc123"
  });
  const request = new Request("https://example.com/api/profile?tgWebAppLaunchMode=compact", {
    headers: {
      "x-telegram-init-data": vector.initData
    },
    method: "POST"
  });

  const context = await createBffRequestContext(request, {
    botId: vector.botId,
    publicKey: vector.publicKeyHex,
    validateInitData: true
  });

  assert.equal(context.auth.type, "telegram");
  assert.equal(context.telegramUser?.id, 279058397);
  assert.equal(context.startParam, "flow_abc123");
  assert.equal(context.launchMode, "compact");
  assert.equal(context.chatInstance, null);
});

test("createBffRequestContext rejects invalid initData signatures", async () => {
  const vector = createEd25519SampleVector();
  const request = new Request("https://example.com/api/profile", {
    headers: {
      "x-telegram-init-data": vector.tamperedInitData
    }
  });

  await assert.rejects(
    () =>
      createBffRequestContext(request, {
        botId: vector.botId,
        publicKey: vector.publicKeyHex,
        validateInitData: true
      }),
    (error) => error instanceof BffContextError && error.code === "INVALID_INIT_DATA"
  );
});

test("createBffRequestContext allows public requests without initData when validation is disabled", async () => {
  const context = await createBffRequestContext(new Request("https://example.com/api/public"), {
    validateInitData: false
  });

  assert.equal(context.auth.type, "none");
  assert.equal(context.telegramUser, null);
  assert.equal(context.initDataRaw, null);
});

test("createBffRequestContext requires botId for Ed25519 validation", async () => {
  const vector = createEd25519SampleVector();
  const request = new Request("https://example.com/api/profile", {
    headers: {
      "x-telegram-init-data": vector.initData
    }
  });

  await assert.rejects(
    () =>
      createBffRequestContext(request, {
        publicKey: vector.publicKeyHex,
        validateInitData: true
      }),
    (error) => error instanceof BffContextError && error.code === "MISSING_BOT_ID"
  );
});

test("createBffRequestContext rejects bot-token validation in non-Node runtimes", async () => {
  const originalProcess = globalThis.process;
  const request = new Request("https://example.com/api/profile", {
    headers: {
      "x-telegram-init-data": "auth_date=1710000000&hash=deadbeef"
    }
  });

  try {
    Reflect.deleteProperty(globalThis, "process");

    await assert.rejects(
      () =>
        createBffRequestContext(request, {
          botToken: "12345:token",
          validateInitData: true
        }),
      (error) => error instanceof BffContextError && error.code === "RUNTIME_UNSUPPORTED_VALIDATION"
    );
  } finally {
    globalThis.process = originalProcess;
  }
});

test("createBffRequestContext generates unique request IDs", async () => {
  const ids = new Set();

  await Promise.all(
    Array.from({ length: 1000 }, async () => {
      const context = await createBffRequestContext(new Request("https://example.com/api/test"), {
        validateInitData: false
      });
      ids.add(context.id);
    })
  );

  assert.equal(ids.size, 1000);
});

function createEd25519SampleVector(options = {}) {
  const authDate = options.authDate ?? Math.floor(Date.now() / 1000);
  const botId = options.botId ?? 12_345_678;
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

  if (options.startParam) {
    params.set("start_param", options.startParam);
  }

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
    publicKeyHex: publicKeyDer.subarray(12).toString("hex"),
    tamperedInitData: params.toString().replace("Integration", "Tampered")
  };
}
