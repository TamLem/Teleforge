import assert from "node:assert/strict";
import test from "node:test";

import {
  defineCoordinationConfig,
  flowCoordination,
  routeCoordination,
  validateCoordinationConfig
} from "../dist/index.js";

test("defineCoordinationConfig resolves flow, route, step, and entry-point lookups", () => {
  const config = defineCoordinationConfig({
    defaults: {
      expiryMinutes: 30,
      persistence: "session",
      returnToChat: {
        text: "Back to chat"
      }
    },
    entryPoints: {
      buttons: {
        buy_now: {
          route: "/checkout",
          text: "Buy now"
        }
      },
      commands: {
        checkout: {
          description: "Start checkout",
          route: "/checkout"
        }
      }
    },
    flows: {
      checkout: flowCoordination("checkout", {
        defaultStep: "cart",
        finalStep: "confirmation",
        onComplete: "return_to_chat",
        steps: ["cart", "payment", "confirmation"]
      })
    },
    routes: {
      "/checkout": routeCoordination("/checkout", {
        entryPoints: [{ command: "checkout", type: "bot_command" }],
        flowId: "checkout",
        stepRoutes: {
          cart: "/checkout",
          confirmation: "/checkout/confirmation",
          payment: "/checkout/payment"
        }
      })
    }
  });

  assert.equal(config.validation.valid, true);
  assert.equal(config.resolveEntryPoint("command", "checkout"), "/checkout");
  assert.equal(config.resolveFlow("checkout")?.defaultStep, "cart");
  assert.equal(config.resolveRoute("/checkout")?.metadata.flow?.entryStep, "cart");
  assert.equal(config.resolveStepRoute("checkout", "payment"), "/checkout/payment");
  assert.equal(config.resolveStep("/checkout/confirmation", "checkout"), "confirmation");
});

test("validateCoordinationConfig reports unknown flows, invalid steps, and duplicate entry points", () => {
  const result = validateCoordinationConfig({
    defaults: {
      expiryMinutes: 30,
      persistence: "memory"
    },
    entryPoints: {
      commands: {
        start: {
          route: "/alpha"
        }
      }
    },
    flows: {
      checkout: {
        defaultStep: "cart",
        finalStep: "done",
        onComplete: "next-flow",
        steps: ["cart", "payment"]
      }
    },
    routes: {
      "/alpha": {
        entryPoints: [{ command: "start", type: "bot_command" }],
        flowId: "missing-flow",
        stepRoutes: {
          cart: "/alpha"
        }
      },
      "/beta": {
        entryPoints: [{ command: "start", type: "bot_command" }],
        flowId: "checkout",
        stepRoutes: {
          unknown: "/beta/unknown"
        }
      }
    }
  });

  assert.equal(result.valid, false);
  assert.equal(
    result.errors.some((error) => error.type === "unknown_flow"),
    true
  );
  assert.equal(
    result.errors.some((error) => error.type === "invalid_step"),
    true
  );
  assert.equal(
    result.errors.some((error) => error.type === "invalid_flow_ref"),
    true
  );
  assert.equal(
    result.errors.some((error) => error.type === "duplicate_entry_point"),
    true
  );
});
