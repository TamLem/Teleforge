import assert from "node:assert/strict";
import test from "node:test";

import {
  createPhoneAuthLink,
  createPhoneNumberRequestButton,
  createPhoneNumberRequestMarkup,
  extractSharedPhoneContact
} from "../../dist/index.js";

test("createPhoneNumberRequestButton creates a contact request button", () => {
  assert.deepEqual(createPhoneNumberRequestButton(), {
    request_contact: true,
    text: "Share phone number"
  });
});

test("createPhoneNumberRequestMarkup creates a reply keyboard around the contact request", () => {
  assert.deepEqual(createPhoneNumberRequestMarkup({ text: "Verify phone" }), {
    keyboard: [
      [
        {
          request_contact: true,
          text: "Verify phone"
        }
      ]
    ],
    one_time_keyboard: true,
    resize_keyboard: true
  });
});

test("extractSharedPhoneContact accepts self-shared contacts and normalizes the phone number", () => {
  const result = extractSharedPhoneContact({
    message: {
      chat: {
        id: 1,
        type: "private"
      },
      contact: {
        first_name: "Dev",
        phone_number: "+1 (202) 555-0199",
        user_id: 42
      },
      from: {
        first_name: "Dev",
        id: 42
      }
    },
    update_id: 1
  });

  assert.deepEqual(result, {
    contact: {
      first_name: "Dev",
      phone_number: "+1 (202) 555-0199",
      user_id: 42
    },
    normalizedPhoneNumber: "+12025550199",
    phoneNumber: "+1 (202) 555-0199",
    telegramUserId: 42
  });
});

test("extractSharedPhoneContact rejects mismatched senders and malformed numbers", () => {
  assert.equal(
    extractSharedPhoneContact({
      message: {
        chat: {
          id: 1,
          type: "private"
        },
        contact: {
          first_name: "Dev",
          phone_number: "+12025550199",
          user_id: 7
        },
        from: {
          first_name: "Dev",
          id: 42
        }
      },
      update_id: 2
    }),
    null
  );

  assert.equal(
    extractSharedPhoneContact({
      message: {
        chat: {
          id: 1,
          type: "private"
        },
        contact: {
          first_name: "Dev",
          phone_number: "not-a-number"
        },
        from: {
          first_name: "Dev",
          id: 42
        }
      },
      update_id: 3
    }),
    null
  );
});

test("createPhoneAuthLink appends a signed phone auth token to the Mini App URL", async () => {
  const url = await createPhoneAuthLink({
    issuedAt: 1_000,
    phoneNumber: "+251 91 234 5678",
    secret: "secret",
    telegramUserId: 42,
    ttlMs: 1_000,
    webAppUrl: "https://example.ngrok.app/app?view=profile"
  });

  const parsed = new URL(url);

  assert.equal(parsed.searchParams.get("view"), "profile");
  assert.ok(parsed.searchParams.get("tfPhoneAuth"));
});
