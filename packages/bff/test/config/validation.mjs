import assert from "node:assert/strict";
import test from "node:test";

import {
  BffValidationError,
  createBffConfig,
  telegramIdIdentityProvider
} from "../../dist/index.js";
import { createIdentityAdapter } from "../helpers/session.mjs";

test("createBffConfig throws CONFIG_INVALID with field details when botToken is missing", () => {
  assert.throws(
    () =>
      createBffConfig({
        botToken: "",
        features: {
          sessions: false
        },
        identity: {
          adapter: createIdentityAdapter(),
          providers: [telegramIdIdentityProvider()]
        }
      }),
    (error) =>
      error instanceof BffValidationError &&
      error.code === "CONFIG_INVALID" &&
      error.fields?.some((field) => field.path === "botToken")
  );
});

test("sessions-enabled config requires both session adapter and jwt secret", () => {
  assert.throws(
    () =>
      createBffConfig({
        botToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
        identity: {
          adapter: createIdentityAdapter(),
          providers: [telegramIdIdentityProvider()]
        }
      }),
    (error) =>
      error instanceof BffValidationError &&
      error.code === "CONFIG_INVALID" &&
      error.fields?.some((field) => field.path === "adapters.session") &&
      error.fields?.some((field) => field.path === "jwt.secret")
  );
});

test("service registrations must match their registry keys", () => {
  assert.throws(
    () =>
      createBffConfig({
        botToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
        features: {
          sessions: false
        },
        identity: {
          adapter: createIdentityAdapter(),
          providers: [telegramIdIdentityProvider()]
        },
        services: {
          users: {
            config: {},
            async invoke() {
              return {
                ok: true
              };
            },
            name: "accounts"
          }
        }
      }),
    (error) =>
      error instanceof BffValidationError &&
      error.code === "CONFIG_INVALID" &&
      error.fields?.some((field) => field.path === "services.users.name")
  );
});

test("identity config requires at least one provider", () => {
  assert.throws(
    () =>
      createBffConfig({
        botToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
        features: {
          sessions: false
        },
        identity: {
          adapter: createIdentityAdapter(),
          providers: []
        }
      }),
    (error) =>
      error instanceof BffValidationError &&
      error.code === "CONFIG_INVALID" &&
      error.fields?.some((field) => field.path === "identity.providers")
  );
});
