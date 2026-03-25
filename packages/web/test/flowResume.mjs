import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import TestRenderer, { act } from "react-test-renderer";

import {
  ExpiredFlowView,
  FlowResumeProvider,
  ResumeIndicator,
  parseResumeParam,
  resumeFlow,
  useFlowState
} from "../dist/index.js";

test("parseResumeParam extracts flow ids from Telegram launch parameters", () => {
  globalThis.window = createMockWindow({
    search: "?startapp=flow_task-shop-browse",
    userId: "42"
  });

  assert.equal(parseResumeParam(), "task-shop-browse");

  globalThis.window = createMockWindow({
    search: "",
    startParam: "flow_checkout",
    userId: "42"
  });

  assert.equal(parseResumeParam(), "checkout");

  delete globalThis.window;
});

test("resumeFlow validates same-user access and maps step ids to routes", async () => {
  const resolver = async () => ({
    createdAt: Date.now(),
    expiresAt: Date.now() + 1_000,
    flowId: "task-shop-browse",
    payload: {},
    stepId: "checkout",
    userId: "42",
    version: 2
  });

  const success = await resumeFlow("task-shop-browse", resolver, {
    currentUserId: "42",
    resolveRoute: (state) => (state.stepId === "checkout" ? "/checkout" : null)
  });

  assert.equal(success.success, true);
  assert.equal(success.redirectTo, "/checkout");

  const invalid = await resumeFlow("task-shop-browse", resolver, {
    currentUserId: "24",
    resolveRoute: (state) => (state.stepId === "checkout" ? "/checkout" : null)
  });

  assert.deepEqual(invalid, {
    error: "invalid",
    success: false
  });
});

test("FlowResumeProvider restores flow context and shows a resume indicator", async () => {
  const windowMock = createMockWindow({
    search: "?tgWebAppStartParam=flow_task-shop-browse",
    userId: "42"
  });
  let snapshot;
  let renderer;

  globalThis.window = windowMock;

  function Probe() {
    snapshot = useFlowState();
    return React.createElement(ResumeIndicator);
  }

  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(
        FlowResumeProvider,
        {
          resolveRoute: (state) => (state.stepId === "cart" ? "/cart" : null),
          resolver: async () => ({
            createdAt: Date.now(),
            expiresAt: Date.now() + 1_000,
            flowId: "task-shop-browse",
            payload: {
              items: [{ id: "task-001", quantity: 1 }]
            },
            stepId: "cart",
            userId: "42",
            version: 3
          })
        },
        React.createElement(Probe)
      )
    );
  });

  await act(async () => {
    await Promise.resolve();
  });

  assert.equal(snapshot.status, "resumed");
  assert.equal(snapshot.redirectTo, "/cart");
  assert.equal(snapshot.flowState?.payload.items[0]?.id, "task-001");
  assert.equal(windowMock.location.search, "");
  assert.match(JSON.stringify(renderer.toJSON()), /Continuing where you left off/);

  await act(async () => {
    renderer.unmount();
  });

  delete globalThis.window;
});

test("ExpiredFlowView renders recovery copy for completed flows", () => {
  const html = renderToString(
    React.createElement(ExpiredFlowView, {
      error: "completed",
      onFreshStart() {}
    })
  );

  assert.match(html, /Already completed/);
  assert.match(html, /Start new flow/);
});

function createMockWindow({ search, startParam = undefined, userId }) {
  let location = new URL(`https://example.com/${search}`);
  const initData = new URLSearchParams({
    auth_date: "1710000000",
    query_id: "test-query",
    ...(startParam ? { start_param: startParam } : {}),
    user: JSON.stringify({
      first_name: "Test",
      id: Number(userId)
    })
  }).toString();

  return {
    Telegram: {
      WebApp: {
        MainButton: {},
        close() {},
        colorScheme: "light",
        expand() {},
        initData,
        initDataUnsafe: {
          ...(startParam ? { start_param: startParam } : {}),
          user: {
            first_name: "Test",
            id: Number(userId)
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
      state: {},
      replaceState(state, _title, url) {
        this.state = state;
        location = new URL(String(url));
      }
    }
  };
}
