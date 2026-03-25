import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import {
  CoordinationProvider,
  useFlowCoordination,
  useFlowNavigation,
  useLaunchCoordination,
  useReturnToChat
} from "../dist/index.js";

test("useLaunchCoordination parses signed launch flow context", async () => {
  let snapshot;

  globalThis.window = createMockWindow({
    pathname: "/checkout",
    search: `?tgWebAppStartParam=${encodeURIComponent(createSignedFlowContext())}`
  });

  function Probe() {
    snapshot = useLaunchCoordination();
    return null;
  }

  await act(async () => {
    TestRenderer.create(React.createElement(Probe));
  });

  assert.equal(snapshot.isValid, true);
  assert.equal(snapshot.flowId, "task-shop-browse");
  assert.equal(snapshot.stepId, "checkout");
  assert.equal(snapshot.entryRoute, "/checkout");
  assert.equal(snapshot.stateKey, "flow:test-state");

  delete globalThis.window;
});

test("useReturnToChat exposes async state and delegates completion payloads", async () => {
  const sent = [];
  let snapshot;

  globalThis.window = createMockWindow({
    pathname: "/checkout",
    search: `?tgWebAppStartParam=${encodeURIComponent(createSignedFlowContext())}`,
    sendData(payload) {
      sent.push(JSON.parse(payload));
    }
  });

  function Probe() {
    snapshot = useReturnToChat();
    return null;
  }

  await act(async () => {
    TestRenderer.create(React.createElement(Probe));
  });

  await act(async () => {
    await snapshot.completeFlow({
      orderId: "ord_123"
    });
  });

  assert.equal(snapshot.isReturning, false);
  assert.equal(snapshot.error, null);
  assert.equal(sent[0]?.data.orderId, "ord_123");
  assert.equal(sent[0]?.result, "completed");

  delete globalThis.window;
});

test("CoordinationProvider persists flow snapshots and useFlowNavigation preserves flow context", async () => {
  let coordination;
  let navigation;
  const persisted = [];
  const navigated = [];
  const config = {
    defaults: {
      expiryMinutes: 30,
      persistence: "session"
    },
    entryPoints: {
      buttons: {},
      commands: {},
      deepLinks: {}
    },
    flows: {
      "task-shop-browse": {
        defaultStep: "catalog",
        finalStep: "completed",
        id: "task-shop-browse",
        steps: ["catalog", "checkout", "completed"]
      }
    },
    resolveEntryPoint() {
      return undefined;
    },
    resolveFlow(flowId) {
      return this.flows[flowId];
    },
    resolveRoute(path) {
      if (path !== "/checkout") {
        return undefined;
      }

      return {
        entryPoints: [{ command: "start", type: "bot_command" }],
        flowId: "task-shop-browse",
        metadata: {
          entryPoints: [{ command: "start", type: "bot_command" }],
          flow: {
            entryStep: "catalog",
            flowId: "task-shop-browse"
          }
        },
        path: "/checkout",
        stepRoutes: {
          catalog: "/",
          checkout: "/checkout",
          completed: "/success"
        }
      };
    },
    resolveStep(path) {
      return path === "/checkout" ? "checkout" : undefined;
    },
    resolveStepRoute(flowId, stepId) {
      if (flowId !== "task-shop-browse") {
        return undefined;
      }

      return (
        {
          catalog: "/",
          checkout: "/checkout",
          completed: "/success"
        }[stepId] ?? undefined
      );
    },
    routes: {},
    validation: {
      errors: [],
      valid: true,
      warnings: []
    }
  };

  globalThis.window = createMockWindow({
    pathname: "/checkout",
    search: `?tgWebAppStartParam=${encodeURIComponent(createSignedFlowContext())}`
  });

  function Probe() {
    coordination = useFlowCoordination("/checkout");
    navigation = useFlowNavigation();
    return null;
  }

  await act(async () => {
    TestRenderer.create(
      React.createElement(
        CoordinationProvider,
        {
          config,
          currentRoute: "/checkout",
          flowSnapshot: {
            items: [{ id: "task-001", quantity: 2 }]
          },
          navigate(route) {
            navigated.push(route);
          },
          persistFlowState(input) {
            persisted.push(input);
            return {
              createdAt: Date.now(),
              expiresAt: Date.now() + 60_000,
              flowId: input.flowId ?? "task-shop-browse",
              payload: input.payload,
              stepId: input.stepId,
              userId: input.userId ?? "42",
              version: 2
            };
          },
          resolveRoute(state) {
            return state.stepId === "checkout" ? "/checkout" : `/${state.stepId}`;
          },
          resolver: async () => ({
            createdAt: Date.now(),
            expiresAt: Date.now() + 60_000,
            flowId: "task-shop-browse",
            payload: {
              items: [{ id: "task-001", quantity: 1 }]
            },
            stepId: "checkout",
            userId: "42",
            version: 1
          })
        },
        React.createElement(Probe)
      )
    );
  });

  await act(async () => {
    await Promise.resolve();
  });

  assert.equal(coordination.coordination?.flow?.flowId, "task-shop-browse");
  assert.equal(persisted.length > 0, true);
  assert.equal(persisted[0]?.route, "/checkout");

  await act(async () => {
    await navigation.navigateToStep("catalog", {
      payload: {
        source: "hook"
      }
    });
  });

  assert.match(navigated[navigated.length - 1] ?? "", /^\/\?tgWebAppStartParam=/);

  delete globalThis.window;
});

function createMockWindow({ pathname, search, sendData = () => {} }) {
  let location = new URL(`https://example.com${pathname}${search}`);

  return {
    Telegram: {
      WebApp: {
        MainButton: {},
        close() {},
        colorScheme: "light",
        expand() {},
        initData: new URLSearchParams({
          auth_date: "1710000000",
          query_id: "test-query",
          user: JSON.stringify({
            first_name: "Test",
            id: 42
          })
        }).toString(),
        initDataUnsafe: {
          user: {
            first_name: "Test",
            id: 42
          }
        },
        isExpanded: false,
        offEvent() {},
        onEvent() {},
        openLink() {},
        openTelegramLink() {},
        platform: "ios",
        ready() {},
        sendData,
        showAlert() {},
        showConfirm() {},
        showPopup() {},
        themeParams: {},
        version: "7.2",
        viewportHeight: 600,
        viewportStableHeight: 580
      }
    },
    get location() {
      return location;
    },
    history: {
      pushState(state, _title, url) {
        this.state = state;
        location = new URL(String(url), location.origin);
      },
      replaceState(state, _title, url) {
        this.state = state;
        location = new URL(String(url), location.origin);
      },
      state: {}
    }
  };
}

function createSignedFlowContext() {
  const payload = Buffer.from(
    JSON.stringify({
      flowId: "task-shop-browse",
      payload: {
        route: "/checkout",
        stateKey: "flow:test-state"
      },
      returnText: "Back to chat",
      stayInChat: true,
      stepId: "checkout"
    }),
    "utf8"
  ).toString("base64url");

  return `tfp1.${payload}.signature`;
}
