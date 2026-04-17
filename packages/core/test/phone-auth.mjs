import assert from "node:assert/strict";
import test from "node:test";

import {
  createSignedPhoneAuthToken,
  normalizePhoneNumber,
  verifySignedPhoneAuthToken
} from "../dist/index.js";

test("normalizePhoneNumber strips formatting but preserves a leading plus", () => {
  assert.equal(normalizePhoneNumber("+1 (202) 555-0199"), "+12025550199");
  assert.equal(normalizePhoneNumber("251 91 234 5678"), "251912345678");
});

test("normalizePhoneNumber rejects unsupported formats", () => {
  assert.equal(normalizePhoneNumber(""), null);
  assert.equal(normalizePhoneNumber("+abc"), null);
  assert.equal(normalizePhoneNumber("555-01"), null);
  assert.equal(normalizePhoneNumber("++12025550199"), null);
});

test("signed phone auth tokens verify and preserve the normalized payload", async () => {
  const token = await createSignedPhoneAuthToken(
    {
      phoneNumber: "+1 (202) 555-0199",
      telegramUserId: 42
    },
    "secret",
    {
      expiresAt: 10_000,
      issuedAt: 5_000
    }
  );

  const payload = await verifySignedPhoneAuthToken(token, "secret", {
    now: 7_000
  });

  assert.deepEqual(payload, {
    expiresAt: 10_000,
    issuedAt: 5_000,
    phoneNumber: "+12025550199",
    telegramUserId: 42
  });
});

test("signed phone auth tokens reject tampering and expiry", async () => {
  const token = await createSignedPhoneAuthToken(
    {
      phoneNumber: "+251 91 234 5678",
      telegramUserId: 99
    },
    "secret",
    {
      expiresAt: 2_000,
      issuedAt: 1_000
    }
  );

  const tampered = `${token.slice(0, -1)}x`;

  assert.equal(await verifySignedPhoneAuthToken(tampered, "secret", { now: 1_500 }), null);
  assert.equal(await verifySignedPhoneAuthToken(token, "secret", { now: 2_500 }), null);
});
