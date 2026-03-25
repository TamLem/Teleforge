import test from "node:test";
import assert from "node:assert/strict";
import React, { useEffect } from "react";
import { renderToString } from "react-dom/server";
import TestRenderer, { act } from "react-test-renderer";
import { useTelegram } from "../dist/index.js";

test("returns SSR-safe defaults when window is unavailable", () => {
  const previousWindow = globalThis.window;
  let snapshot;

  delete globalThis.window;

  function Probe() {
    snapshot = useTelegram();
    return null;
  }

  renderToString(React.createElement(Probe));

  assert.equal(snapshot.tg, null);
  assert.equal(snapshot.isReady, false);
  assert.equal(snapshot.isMock, false);
  assert.equal(snapshot.platform, "unknown");
  assert.equal(snapshot.viewportHeight, 0);

  if (previousWindow) {
    globalThis.window = previousWindow;
  }
});

test("initializes the Telegram SDK exactly once and detects the mock environment", async () => {
  const mock = createMockWebApp();
  let snapshot;

  globalThis.window = {
    __teleforgeMockInstalled: true,
    Telegram: {
      WebApp: mock
    }
  };

  function Probe() {
    const value = useTelegram();
    useEffect(() => {
      snapshot = value;
    }, [value]);
    snapshot = value;
    return null;
  }

  await act(async () => {
    TestRenderer.create(React.createElement(Probe));
  });

  assert.equal(snapshot.tg, mock);
  assert.equal(snapshot.isReady, true);
  assert.equal(snapshot.isMock, true);
  assert.equal(snapshot.user?.id, 42);
  assert.equal(mock.readyCallCount, 1);

  delete globalThis.window;
});

test("reacts to viewport and theme changes from Telegram events", async () => {
  const mock = createMockWebApp();
  let snapshot;
  let renderer;

  globalThis.window = {
    __teleforgeMockInstalled: false,
    Telegram: {
      WebApp: mock
    }
  };

  function Probe() {
    snapshot = useTelegram();
    return null;
  }

  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Probe));
  });

  mock.viewportHeight = 512;
  mock.viewportStableHeight = 480;
  mock.isExpanded = true;
  mock.colorScheme = "dark";
  mock.themeParams = {
    bg_color: "#000000",
    text_color: "#ffffff"
  };

  await act(async () => {
    mock.emit("viewportChanged");
    mock.emit("themeChanged");
  });

  assert.equal(snapshot.viewportHeight, 512);
  assert.equal(snapshot.viewportStableHeight, 480);
  assert.equal(snapshot.isExpanded, true);
  assert.equal(snapshot.colorScheme, "dark");
  assert.equal(snapshot.themeParams.bg_color, "#000000");

  await act(async () => {
    renderer.unmount();
  });

  assert.equal(mock.listenerCount("viewportChanged"), 0);
  assert.equal(mock.listenerCount("themeChanged"), 0);

  delete globalThis.window;
});

function createMockWebApp() {
  const listeners = new Map();

  return {
    CloudStorage: {
      getItem(_key, callback) {
        callback?.(null, null);
      },
      getItems(_keys, callback) {
        callback?.(null, {});
      },
      removeItem(_key, callback) {
        callback?.(null, true);
      },
      removeItems(_keys, callback) {
        callback?.(null, true);
      },
      setItem(_key, _value, callback) {
        callback?.(null, true);
      }
    },
    HapticFeedback: {
      impactOccurred() {},
      notificationOccurred() {},
      selectionChanged() {}
    },
    close() {},
    colorScheme: "light",
    emit(event) {
      for (const handler of listeners.get(event) ?? []) {
        handler();
      }
    },
    expand() {},
    initData: "query_id=test",
    initDataUnsafe: {
      user: {
        first_name: "Dev",
        id: 42,
        username: "teleforge_dev"
      }
    },
    isExpanded: false,
    listenerCount(event) {
      return listeners.get(event)?.size ?? 0;
    },
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
    ready() {
      this.readyCallCount += 1;
    },
    readyCallCount: 0,
    sendData() {},
    showAlert(_message, callback) {
      callback?.();
    },
    showConfirm(_message, callback) {
      callback?.(true);
    },
    showPopup(_params, callback) {
      callback?.("ok");
    },
    themeParams: {
      bg_color: "#ffffff"
    },
    version: "7.2",
    viewportHeight: 420,
    viewportStableHeight: 400
  };
}
