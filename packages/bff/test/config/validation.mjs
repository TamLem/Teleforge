import assert from "node:assert/strict";
import test from "node:test";

import { BffValidationError, createBffConfig } from "../../dist/index.js";
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
          adapter: createIdentityAdapter()
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
          adapter: createIdentityAdapter()
        }
      }),
    (error) =>
      error instanceof BffValidationError &&
      error.code === "CONFIG_INVALID" &&
      error.fields?.some((field) => field.path === "adapters.session") &&
      error.fields?.some((field) => field.path === "jwt.secret")
  );
});
