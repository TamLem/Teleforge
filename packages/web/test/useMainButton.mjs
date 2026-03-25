import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import TestRenderer, { act } from "react-test-renderer";
import { useMainButton } from "../dist/index.js";

test("returns safe defaults outside Telegram", () => {
  const previousWindow = globalThis.window;
  let snapshot;

  delete globalThis.window;

  function Probe() {
    snapshot = useMainButton();
    return null;
  }

  renderToString(React.createElement(Probe));

  assert.equal(snapshot.isVisible, false);
  assert.equal(snapshot.isActive, true);
  assert.equal(snapshot.isProgressVisible, false);
  assert.equal(snapshot.text, "CONTINUE");

  if (previousWindow) {
    globalThis.window = previousWindow;
  }
});

test("controls the Telegram Main Button and mirrors state", async () => {
  const mainButton = createMockMainButton();
  const webApp = createMockWebApp(mainButton);
  let snapshot;
  let renderer;

  globalThis.window = {
    Telegram: {
      WebApp: webApp
    }
  };

  function Probe() {
    snapshot = useMainButton({
      isVisible: true,
      text: "PAY"
    });
    return null;
  }

  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Probe));
  });

  assert.equal(snapshot.isVisible, true);
  assert.equal(snapshot.text, "PAY");
  assert.equal(mainButton.text, "PAY");

  await act(async () => {
    snapshot.hide();
    snapshot.disable();
    snapshot.showProgress();
    snapshot.setText("PROCESSING");
  });

  assert.equal(snapshot.isVisible, false);
  assert.equal(snapshot.isActive, false);
  assert.equal(snapshot.isProgressVisible, true);
  assert.equal(snapshot.text, "PROCESSING");

  await act(async () => {
    snapshot.hideProgress();
    snapshot.enable();
    snapshot.show();
    snapshot.setParams({
      color: "#2481cc",
      text_color: "#ffffff"
    });
  });

  assert.equal(snapshot.isProgressVisible, false);
  assert.equal(snapshot.isActive, true);
  assert.equal(snapshot.isVisible, true);
  assert.equal(snapshot.color, "#2481cc");
  assert.equal(snapshot.textColor, "#ffffff");

  await act(async () => {
    renderer.unmount();
  });

  assert.equal(mainButton.hideCallCount > 0, true);

  delete globalThis.window;
});

test("registers click handlers with cleanup", async () => {
  const mainButton = createMockMainButton();
  const webApp = createMockWebApp(mainButton);
  let snapshot;
  let calls = 0;
  let renderer;

  globalThis.window = {
    Telegram: {
      WebApp: webApp
    }
  };

  function Probe() {
    snapshot = useMainButton();
    return null;
  }

  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Probe));
  });

  const cleanup = snapshot.onClick(() => {
    calls += 1;
  });

  mainButton.triggerClick();
  assert.equal(calls, 1);
  assert.equal(mainButton.listenerCount(), 1);

  cleanup();
  mainButton.triggerClick();
  assert.equal(calls, 1);
  assert.equal(mainButton.listenerCount(), 0);

  const autoCleanup = snapshot.onClick(() => {
    calls += 1;
  });
  void autoCleanup;

  await act(async () => {
    renderer.unmount();
  });

  assert.equal(mainButton.listenerCount(), 0);

  delete globalThis.window;
});

function createMockWebApp(mainButton) {
  const listeners = new Map();

  return {
    MainButton: mainButton,
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

function createMockMainButton() {
  const clickHandlers = new Set();

  return {
    color: "",
    disableCallCount: 0,
    disable() {
      this.disableCallCount += 1;
      this.isActive = false;
    },
    enableCallCount: 0,
    enable() {
      this.enableCallCount += 1;
      this.isActive = true;
    },
    hideCallCount: 0,
    hide() {
      this.hideCallCount += 1;
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
    listenerCount() {
      return clickHandlers.size;
    },
    offClick(callback) {
      clickHandlers.delete(callback);
    },
    onClick(callback) {
      clickHandlers.add(callback);
    },
    setParams(params) {
      if (params.color !== undefined) {
        this.color = params.color;
      }
      if (params.text_color !== undefined) {
        this.textColor = params.text_color;
      }
      if (params.is_visible !== undefined) {
        this.isVisible = params.is_visible;
      }
      if (params.is_active !== undefined) {
        this.isActive = params.is_active;
      }
      if (params.is_progress_visible !== undefined) {
        this.isProgressVisible = params.is_progress_visible;
      }
    },
    setText(text) {
      this.text = text;
    },
    showCallCount: 0,
    show() {
      this.showCallCount += 1;
      this.isVisible = true;
    },
    showProgressCallCount: 0,
    showProgress(leaveActive = false) {
      this.showProgressCallCount += 1;
      this.isProgressVisible = true;
      if (!leaveActive) {
        this.isActive = false;
      }
    },
    text: "",
    textColor: "",
    triggerClick() {
      for (const handler of clickHandlers) {
        handler();
      }
    }
  };
}
