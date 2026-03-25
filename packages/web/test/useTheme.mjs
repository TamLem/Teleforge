import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import TestRenderer, { act } from "react-test-renderer";
import { useTheme } from "../dist/index.js";

test("returns SSR-safe light theme defaults", () => {
  const previousWindow = globalThis.window;
  let snapshot;

  delete globalThis.window;

  function Probe() {
    snapshot = useTheme();
    return null;
  }

  renderToString(React.createElement(Probe));

  assert.equal(snapshot.colorScheme, "light");
  assert.equal(snapshot.isLight, true);
  assert.equal(snapshot.bgColor, "#ffffff");
  assert.equal(snapshot.cssVariables["--tg-theme-text-color"], "#000000");

  if (previousWindow) {
    globalThis.window = previousWindow;
  }
});

test("maps theme values and CSS variables from Telegram", async () => {
  const mock = createMockWebApp();
  let snapshot;

  globalThis.window = {
    __teleforgeMockInstalled: false,
    Telegram: {
      WebApp: mock
    }
  };

  function Probe() {
    snapshot = useTheme();
    return null;
  }

  await act(async () => {
    TestRenderer.create(React.createElement(Probe));
  });

  assert.equal(snapshot.isDark, true);
  assert.equal(snapshot.bgColor, "#101010");
  assert.equal(snapshot.textColor, "#f5f5f5");
  assert.equal(snapshot.cssVariables["--tg-theme-bg-color"], "#101010");
  assert.equal(snapshot.cssVariables["--tg-theme-button-color"], "#2ea6ff");

  delete globalThis.window;
});

test("updates when theme changes and keeps a stable reference for unchanged theme input", async () => {
  const mock = createMockWebApp();
  let snapshot;
  let renderer;

  globalThis.window = {
    __teleforgeMockInstalled: false,
    Telegram: {
      WebApp: mock
    }
  };

  function Probe({ tick = 0 }) {
    void tick;
    snapshot = useTheme();
    return null;
  }

  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Probe, { tick: 0 }));
  });

  const initial = snapshot;

  await act(async () => {
    renderer.update(React.createElement(Probe, { tick: 1 }));
  });

  assert.equal(snapshot, initial);

  mock.colorScheme = "light";
  mock.themeParams = {
    ...mock.themeParams,
    bg_color: "#ffffff",
    text_color: "#1c1c1e"
  };

  await act(async () => {
    mock.emit("themeChanged");
  });

  assert.notEqual(snapshot, initial);
  assert.equal(snapshot.isLight, true);
  assert.equal(snapshot.bgColor, "#ffffff");
  assert.equal(snapshot.textColor, "#1c1c1e");

  await act(async () => {
    renderer.unmount();
  });

  delete globalThis.window;
});

function createMockWebApp() {
  const listeners = new Map();

  return {
    close() {},
    colorScheme: "dark",
    emit(event) {
      for (const handler of listeners.get(event) ?? []) {
        handler();
      }
    },
    expand() {},
    initData: "query_id=test",
    initDataUnsafe: {
      user: {
        first_name: "Theme",
        id: 7
      }
    },
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
    themeParams: {
      bg_color: "#101010",
      button_color: "#2ea6ff",
      button_text_color: "#ffffff",
      hint_color: "#8e8e93",
      text_color: "#f5f5f5"
    },
    version: "7.2",
    viewportHeight: 600,
    viewportStableHeight: 580
  };
}
