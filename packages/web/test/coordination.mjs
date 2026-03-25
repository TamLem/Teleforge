import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { completeFlow, transmitResult, useCoordinatedMainButton } from "../dist/index.js";

test("completeFlow infers flow context and uses Telegram sendData", async () => {
  const sent = [];
  let closed = 0;
  const flowContext = createSignedFlowContext();

  globalThis.window = {
    Telegram: {
      WebApp: {
        MainButton: {},
        close() {
          closed += 1;
        },
        colorScheme: "light",
        expand() {},
        initData: "query_id=test",
        initDataUnsafe: {},
        isExpanded: false,
        offEvent() {},
        onEvent() {},
        openLink() {},
        openTelegramLink() {},
        platform: "ios",
        ready() {},
        sendData(payload) {
          sent.push(JSON.parse(payload));
        },
        showAlert() {},
        showConfirm() {},
        showPopup() {},
        themeParams: {},
        version: "7.2",
        viewportHeight: 600,
        viewportStableHeight: 580
      }
    },
    location: {
      search: `?tgWebAppStartParam=${encodeURIComponent(flowContext)}`
    }
  };

  await completeFlow({
    order: {
      items: [],
      total: 0
    }
  });

  assert.equal(sent[0]?.type, "miniapp_return");
  assert.equal(sent[0]?.result, "completed");
  assert.equal(sent[0]?.flowContext, flowContext);
  assert.equal(sent[0]?.stateKey, "flow:test-state");
  assert.equal(closed, 1);

  delete globalThis.window;
});

test("transmitResult falls back to a configured BFF endpoint", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  delete globalThis.window;
  globalThis.fetch = async (url, init) => {
    calls.push({ init, url });
    return {
      ok: true,
      status: 200
    };
  };

  const result = await transmitResult(
    {
      flowContext: createSignedFlowContext(),
      result: "completed",
      stateKey: "flow:test-state"
    },
    {
      bffEndpoint: "https://example.com/return"
    }
  );

  assert.equal(result.method, "bff");
  assert.equal(calls[0]?.url, "https://example.com/return");

  globalThis.fetch = originalFetch;
});

test("useCoordinatedMainButton drives async main-button progress", async () => {
  const mainButton = createMockMainButton();
  const webApp = createMockWebApp(mainButton);
  let snapshot;
  let renderer;
  let resolveClick;
  let calls = 0;

  globalThis.window = {
    Telegram: {
      WebApp: webApp
    }
  };

  function Probe() {
    snapshot = useCoordinatedMainButton(
      "Return to Chat",
      () =>
        new Promise((resolve) => {
          resolveClick = () => {
            calls += 1;
            resolve();
          };
        }),
      {
        isVisible: true
      }
    );
    return null;
  }

  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Probe));
  });

  await act(async () => {
    mainButton.triggerClick();
  });

  assert.equal(mainButton.showProgressCallCount > 0, true);
  resolveClick();

  await act(async () => {
    await Promise.resolve();
  });

  assert.equal(calls, 1);
  assert.equal(mainButton.hideProgressCallCount > 0, true);
  assert.equal(snapshot.closeAfterSend, true);

  await act(async () => {
    renderer.unmount();
  });

  delete globalThis.window;
});

function createMockWebApp(mainButton) {
  return {
    MainButton: mainButton,
    close() {},
    colorScheme: "light",
    expand() {},
    initData: "query_id=test",
    initDataUnsafe: {},
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
  };
}

function createMockMainButton() {
  const clickHandlers = new Set();

  return {
    disable() {
      this.isActive = false;
    },
    enable() {
      this.isActive = true;
    },
    hide() {
      this.isVisible = false;
    },
    hideProgressCallCount: 0,
    hideProgress() {
      this.hideProgressCallCount += 1;
      this.isProgressVisible = false;
    },
    isActive: true,
    isProgressVisible: false,
    isVisible: false,
    offClick(callback) {
      clickHandlers.delete(callback);
    },
    onClick(callback) {
      clickHandlers.add(callback);
    },
    setParams(params) {
      if (params.is_visible !== undefined) {
        this.isVisible = params.is_visible;
      }
    },
    setText(text) {
      this.text = text;
    },
    show() {
      this.isVisible = true;
    },
    showProgressCallCount: 0,
    showProgress() {
      this.showProgressCallCount += 1;
      this.isProgressVisible = true;
    },
    text: "",
    triggerClick() {
      for (const handler of clickHandlers) {
        handler();
      }
    }
  };
}

function createSignedFlowContext() {
  const payload = Buffer.from(
    JSON.stringify({
      flowId: "task-shop-browse",
      payload: {
        stateKey: "flow:test-state"
      },
      stepId: "checkout"
    }),
    "utf8"
  ).toString("base64url");

  return `tfp1.${payload}.signature`;
}
