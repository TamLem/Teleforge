import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { validateInitDataBotToken, validateInitDataEd25519 } from "../dist/index.js";

const botToken = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
const validInitData =
  "auth_date=1710000000&query_id=AAHdF6IQAAAAAN0XohDhrOrc&start_param=checkout&user=%7B%22id%22%3A279058397%2C%22first_name%22%3A%22Vladislav%22%2C%22last_name%22%3A%22Kibenko%22%2C%22username%22%3A%22vdkfrost%22%2C%22language_code%22%3A%22ru%22%2C%22allows_write_to_pm%22%3Atrue%7D&hash=c0c04baa75d833b25f9f3fd95cdf040e6d66d74414739d71bc728d9fa80fa4be";

test("validates a known-good initData vector with bot-token HMAC", () => {
  const result = validateInitDataBotToken(validInitData, botToken, {
    maxAge: Number.MAX_SAFE_INTEGER
  });

  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.data.query_id, "AAHdF6IQAAAAAN0XohDhrOrc");
    assert.equal(result.data.start_param, "checkout");
    assert.equal(result.data.user?.username, "vdkfrost");
  }
});

test("rejects initData when the hash is missing or malformed", () => {
  assert.deepEqual(validateInitDataBotToken("auth_date=1710000000", botToken), {
    error: "Missing hash field.",
    valid: false
  });

  assert.deepEqual(validateInitDataBotToken("auth_date=1710000000&hash=not-hex", botToken), {
    error: "Invalid hash encoding.",
    valid: false
  });
});

test("rejects tampered or expired initData", () => {
  const tampered = validInitData.replace("checkout", "refund");
  const tamperedResult = validateInitDataBotToken(tampered, botToken, {
    maxAge: Number.MAX_SAFE_INTEGER
  });

  assert.deepEqual(tamperedResult, {
    error: "Invalid hash.",
    valid: false
  });

  const expiredResult = validateInitDataBotToken(validInitData, botToken, {
    maxAge: 60
  });

  assert.deepEqual(expiredResult, {
    error: "initData expired.",
    expired: true,
    valid: false
  });
});

test("rejects missing bot token and invalid auth_date fields", () => {
  assert.deepEqual(validateInitDataBotToken(validInitData, ""), {
    error: "Bot token is required.",
    valid: false
  });

  const invalidAuthDateInitData = validInitData
    .replace("auth_date=1710000000", "auth_date=oops")
    .replace(
      "c0c04baa75d833b25f9f3fd95cdf040e6d66d74414739d71bc728d9fa80fa4be",
      "0c1b2c80b38f31b8214fe3f53a945690bc7ed7b6c40004ca1c6f2de5a6f1ed61"
    );

  assert.deepEqual(
    validateInitDataBotToken(invalidAuthDateInitData, botToken, {
      maxAge: Number.MAX_SAFE_INTEGER
    }),
    {
      error: "Invalid auth_date field.",
      valid: false
    }
  );
});

test("validates initData with Ed25519 using hex and byte public keys", async () => {
  const vector = createSignedEd25519Vector({
    authDate: 1710000000,
    botId: 12345678,
    queryId: "AAHdF6IQAAAAAN0XohDhrOrc",
    startParam: "checkout",
    user: {
      first_name: "Vladislav",
      id: 279058397,
      username: "vdkfrost"
    }
  });

  const resultFromHex = await validateInitDataEd25519(vector.initData, vector.publicKeyHex, {
    botId: vector.botId,
    maxAge: Number.MAX_SAFE_INTEGER
  });
  const resultFromBytes = await validateInitDataEd25519(vector.initData, vector.publicKeyBytes, {
    botId: vector.botId,
    maxAge: Number.MAX_SAFE_INTEGER
  });

  assert.equal(resultFromHex.valid, true);
  assert.equal(resultFromBytes.valid, true);

  if (resultFromHex.valid) {
    assert.equal(resultFromHex.data.user?.username, "vdkfrost");
    assert.equal(resultFromHex.data.start_param, "checkout");
  }
});

test("rejects tampered, expired, and malformed Ed25519 initData", async () => {
  const vector = createSignedEd25519Vector({
    authDate: 1710000000,
    botId: 87654321,
    queryId: "AAHdF6IQAAAAAN0XohDhrOrc",
    user: {
      first_name: "Aj",
      id: 1
    }
  });

  const tampered = vector.initData.replace("first_name%22%3A%22Aj%22", "first_name%22%3A%22Eve%22");

  assert.deepEqual(
    await validateInitDataEd25519(tampered, vector.publicKeyHex, {
      botId: vector.botId,
      maxAge: Number.MAX_SAFE_INTEGER
    }),
    {
      error: "Invalid signature.",
      valid: false
    }
  );

  assert.deepEqual(
    await validateInitDataEd25519(vector.initData, vector.publicKeyHex, {
      botId: vector.botId,
      maxAge: 60
    }),
    {
      error: "initData expired.",
      expired: true,
      valid: false
    }
  );

  assert.deepEqual(
    await validateInitDataEd25519("auth_date=1710000000&query_id=test", vector.publicKeyHex, {
      botId: vector.botId
    }),
    {
      error: "Missing signature field.",
      valid: false
    }
  );

  assert.deepEqual(
    await validateInitDataEd25519(vector.initData, "zz", {
      botId: vector.botId
    }),
    {
      error: "Invalid public key encoding.",
      valid: false
    }
  );
});

function createSignedEd25519Vector({ authDate, botId, queryId, startParam, user }) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const params = new URLSearchParams();

  params.set("auth_date", String(authDate));
  params.set("query_id", queryId);

  if (startParam) {
    params.set("start_param", startParam);
  }

  if (user) {
    params.set("user", JSON.stringify(user));
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
  const publicKeyHex = publicKeyDer.subarray(12).toString("hex");

  return {
    botId,
    initData: params.toString(),
    publicKeyBytes: Uint8Array.from(publicKeyDer.subarray(12)),
    publicKeyHex
  };
}
