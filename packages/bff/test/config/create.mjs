import assert from "node:assert/strict";
import test from "node:test";

import { createBffConfig } from "../../dist/index.js";
import { createIdentityAdapter, createMemorySessionAdapter } from "../helpers/session.mjs";

test("createBffConfig returns a validated immutable config with bound adapters", () => {
  const session = createMemorySessionAdapter();
  const users = {
    config: {
      baseUrl: "https://services.example.com"
    },
    async invoke() {
      return {
        ok: true
      };
    },
    name: "users"
  };
  const config = createBffConfig({
    adapters: {
      session
    },
    botToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    identity: {
      adapter: createIdentityAdapter()
    },
    jwt: {
      secret: "teleforge-jwt-secret"
    },
    services: {
      users
    }
  });

  assert.equal(config.adapters.identity, config.options.identity.adapter);
  assert.equal(config.adapters.session, session);
  assert.equal(config.features.sessions, true);
  assert.equal(config.identity.strategy, "telegram-id");
  assert.equal(config.identity.autoCreate, true);
  assert.equal(config.services.users, users);
  assert.equal(config.validate(), true);
  assert.equal(Object.isFrozen(config.options), true);
  assert.throws(() => {
    config.options.botToken = "mutated";
  });
  assert.throws(() => {
    config.services.users = null;
  });
});
