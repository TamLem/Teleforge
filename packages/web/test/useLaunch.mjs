import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import TestRenderer, { act } from "react-test-renderer";
import { useLaunch } from "../dist/index.js";

const manifest = {
  id: "sample-app",
  name: "Sample App",
  version: "1.0.0",
  runtime: {
    mode: "spa",
    webFramework: "vite"
  },
  bot: {
    username: "sample_bot",
    tokenEnv: "BOT_TOKEN",
    webhook: {
      path: "/api/webhook",
      secretEnv: "BOT_WEBHOOK_SECRET"
    }
  },
  miniApp: {
    entryPoint: "apps/web/src/main.tsx",
    launchModes: ["compact", "fullscreen"],
    defaultMode: "compact",
    capabilities: ["read_access", "payments"]
  },
  routes: [
    {
      path: "/"
    }
  ]
};

test("returns SSR-safe defaults when window is unavailable", () => {
  const previousWindow = globalThis.window;
  let snapshot;

  delete globalThis.window;

  function Probe() {
    snapshot = useLaunch();
    return null;
  }

  renderToString(React.createElement(Probe));

  assert.equal(snapshot.context, null);
  assert.equal(snapshot.isReady, false);
  assert.equal(snapshot.mode, null);
  assert.equal(snapshot.platform, "unknown");
  assert.equal(snapshot.initData, "");
  assert.deepEqual(snapshot.validationErrors, []);

  if (previousWindow) {
    globalThis.window = previousWindow;
  }
});

test("handles missing Telegram gracefully in the browser", async () => {
  let snapshot;

  globalThis.window = {
    location: {
      search: "?startapp=checkout"
    }
  };

  function Probe() {
    snapshot = useLaunch();
    return null;
  }

  await act(async () => {
    TestRenderer.create(React.createElement(Probe));
  });

  assert.equal(snapshot.context, null);
  assert.equal(snapshot.isReady, false);
  assert.equal(snapshot.startParam, null);
  assert.equal(snapshot.platform, "unknown");

  delete globalThis.window;
});

test("parses launch context when Telegram is ready and tracks viewport changes", async () => {
  const mock = createMockWebApp();
  let snapshot;
  let renderer;

  globalThis.window = {
    Telegram: {
      WebApp: mock
    },
    location: {
      search: "?startapp=checkout"
    }
  };

  function Probe() {
    snapshot = useLaunch();
    return null;
  }

  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Probe));
  });

  assert.equal(snapshot.isReady, true);
  assert.equal(snapshot.mode, "compact");
  assert.equal(snapshot.platform, "ios");
  assert.equal(snapshot.startParam, "checkout");
  assert.equal(snapshot.user?.id, 42);
  assert.equal(snapshot.isAuthenticated, true);
  assert.equal(snapshot.capabilities.canExpand, true);
  assert.equal(snapshot.capabilities.supportsPayments, true);
  assert.equal(snapshot.capabilities.supportsCloudStorage, true);
  assert.equal(snapshot.capabilities.supportsHapticFeedback, true);

  mock.viewportHeight = 760;
  mock.viewportStableHeight = 720;
  mock.isExpanded = true;

  await act(async () => {
    mock.emit("viewportChanged");
  });

  assert.equal(snapshot.mode, "fullscreen");
  assert.equal(snapshot.capabilities.canExpand, false);

  await act(async () => {
    renderer.unmount();
  });

  assert.equal(mock.listenerCount("viewportChanged"), 0);
  assert.equal(mock.listenerCount("themeChanged"), 0);

  delete globalThis.window;
});

test("validates against a manifest and exposes validation errors", async () => {
  const mock = createMockWebApp({
    platform: "unknown",
    version: "6.0",
    viewportHeight: 180,
    viewportStableHeight: 160
  });
  let snapshot;

  globalThis.window = {
    Telegram: {
      WebApp: mock
    },
    location: {
      search: ""
    }
  };

  function Probe() {
    snapshot = useLaunch();
    return null;
  }

  await act(async () => {
    TestRenderer.create(React.createElement(Probe));
  });

  assert.equal(snapshot.validateAgainstManifest(manifest), false);
  assert.equal(snapshot.isValidForManifest, false);
  assert.match(snapshot.validationErrors.join("\n"), /Launch mode|Unable to determine/);

  delete globalThis.window;
});

function createMockWebApp(overrides = {}) {
  const listeners = new Map();
  const initData = new URLSearchParams({
    auth_date: "1710000000",
    hash: "deadbeef",
    query_id: "query-123",
    user: JSON.stringify({
      first_name: "Dev",
      id: 42,
      username: "teleforge_dev"
    })
  }).toString();

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
    initData,
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
    viewportHeight: 540,
    viewportStableHeight: 520,
    ...overrides
  };
}
