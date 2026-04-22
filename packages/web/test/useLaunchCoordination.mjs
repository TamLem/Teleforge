import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { useLaunchCoordination } from "../dist/index.js";

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

function createMockWindow({ pathname, search }) {
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
        sendData() {},
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
