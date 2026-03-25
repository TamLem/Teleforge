import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import TestRenderer, { act } from "react-test-renderer";

import { useBackButton } from "../dist/index.js";

test("returns safe defaults outside Telegram", () => {
  const previousWindow = globalThis.window;
  let snapshot;

  delete globalThis.window;

  function Probe() {
    snapshot = useBackButton();
    return null;
  }

  renderToString(React.createElement(Probe));

  assert.equal(snapshot.isVisible, false);

  if (previousWindow) {
    globalThis.window = previousWindow;
  }
});

test("controls the Telegram Back Button and mirrors state", async () => {
  const backButton = createMockBackButton();
  const webApp = createMockWebApp(backButton);
  let snapshot;
  let renderer;

  globalThis.window = {
    Telegram: {
      WebApp: webApp
    }
  };

  function Probe() {
    snapshot = useBackButton({
      isVisible: true
    });
    return null;
  }

  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Probe));
  });

  assert.equal(snapshot.isVisible, true);
  assert.equal(backButton.isVisible, true);

  await act(async () => {
    snapshot.hide();
  });

  assert.equal(snapshot.isVisible, false);
  assert.equal(backButton.isVisible, false);

  await act(async () => {
    snapshot.show();
  });

  assert.equal(snapshot.isVisible, true);
  assert.equal(backButton.isVisible, true);

  await act(async () => {
    renderer.unmount();
  });

  assert.equal(backButton.hideCallCount > 0, true);

  delete globalThis.window;
});

test("registers click handlers with cleanup", async () => {
  const backButton = createMockBackButton();
  const webApp = createMockWebApp(backButton);
  let snapshot;
  let calls = 0;
  let renderer;

  globalThis.window = {
    Telegram: {
      WebApp: webApp
    }
  };

  function Probe() {
    snapshot = useBackButton();
    return null;
  }

  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Probe));
  });

  const cleanup = snapshot.onClick(() => {
    calls += 1;
  });

  backButton.triggerClick();
  assert.equal(calls, 1);
  assert.equal(backButton.listenerCount(), 1);

  cleanup();
  backButton.triggerClick();
  assert.equal(calls, 1);
  assert.equal(backButton.listenerCount(), 0);

  snapshot.onClick(() => {
    calls += 1;
  });

  await act(async () => {
    renderer.unmount();
  });

  assert.equal(backButton.listenerCount(), 0);

  delete globalThis.window;
});

function createMockWebApp(backButton) {
  const listeners = new Map();

  return {
    BackButton: backButton,
    close() {},
    colorScheme: "light",
    expand() {},
    initData: "query_id=test",
    initDataUnsafe: {},
    isExpanded: false,
    offEvent(event, callback) {
      listeners.get(event)?.delete(callback);
    },
    onEvent(event, callback) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event).add(callback);
    },
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

function createMockBackButton() {
  const clickHandlers = new Set();

  return {
    hideCallCount: 0,
    hide() {
      this.hideCallCount += 1;
      this.isVisible = false;
    },
    isVisible: false,
    listenerCount() {
      return clickHandlers.size;
    },
    offClick(callback) {
      clickHandlers.delete(callback);
    },
    onClick(callback) {
      clickHandlers.add(callback);
    },
    showCallCount: 0,
    show() {
      this.showCallCount += 1;
      this.isVisible = true;
    },
    triggerClick() {
      for (const callback of clickHandlers) {
        callback();
      }
    }
  };
}
