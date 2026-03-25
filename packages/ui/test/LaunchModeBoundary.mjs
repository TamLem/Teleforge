import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import TestRenderer, { act } from "react-test-renderer";
import { ExpandedOnly, FullscreenOnly, LaunchModeBoundary, useLaunchMode } from "../dist/index.js";

test("renders loading state on the server", () => {
  const previousWindow = globalThis.window;
  delete globalThis.window;

  const html = renderToString(
    React.createElement(
      LaunchModeBoundary,
      {
        modes: ["fullscreen"]
      },
      React.createElement("div", null, "Video")
    )
  );

  assert.match(html, /Detecting launch mode/);

  if (previousWindow) {
    globalThis.window = previousWindow;
  }
});

test("renders children when the current mode is allowed", async () => {
  const webApp = createMockWebApp({
    platform: "ios",
    viewportStableHeight: 620
  });

  globalThis.window = createMockWindow(webApp);

  let renderer;

  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(ExpandedOnly, null, React.createElement("div", null, "Checkout"))
    );
  });

  assert.equal(renderer.root.findByType("div").children.includes("Checkout"), true);

  delete globalThis.window;
});

test("supports fallback, redirects, and launch mode transitions", async () => {
  const webApp = createMockWebApp({
    platform: "ios",
    viewportStableHeight: 620
  });
  const mockWindow = createMockWindow(webApp);
  const seenModes = [];
  let renderer;
  let launchModeState;

  globalThis.window = mockWindow;

  function ModeProbe() {
    launchModeState = useLaunchMode();
    return null;
  }

  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(ModeProbe),
        React.createElement(
          LaunchModeBoundary,
          {
            fallback: React.createElement("div", null, "Please expand"),
            modes: ["fullscreen"]
          },
          React.createElement("div", null, "Video")
        ),
        React.createElement(
          LaunchModeBoundary,
          {
            modes: ["fullscreen"],
            onModeChange: (mode) => {
              seenModes.push(mode);
            },
            redirectTo: "/fullscreen"
          },
          React.createElement("div", null, "Redirected")
        ),
        React.createElement(
          FullscreenOnly,
          {
            showExpandPrompt: true
          },
          React.createElement("div", null, "Immersive")
        )
      )
    );
  });

  assert.equal(launchModeState.mode, "compact");
  assert.equal(launchModeState.isCompact, true);
  assert.equal(launchModeState.canRender(["fullscreen"]), false);
  assert.equal(mockWindow.location.lastReplace, "/fullscreen");

  const textContentBeforeExpand = JSON.stringify(renderer.toJSON());
  assert.match(textContentBeforeExpand, /Please expand/);
  assert.match(textContentBeforeExpand, /Expand App/);
  assert.deepEqual(seenModes, ["compact"]);

  await act(async () => {
    const buttons = renderer.root.findAllByType("button");
    buttons[0].props.onClick();
  });

  const textContentAfterExpand = JSON.stringify(renderer.toJSON());
  assert.match(textContentAfterExpand, /Video/);
  assert.match(textContentAfterExpand, /Immersive/);
  assert.equal(launchModeState.mode, "fullscreen");
  assert.equal(launchModeState.isFullscreen, true);
  assert.equal(launchModeState.canRender(["fullscreen"]), true);
  assert.deepEqual(seenModes, ["compact", "fullscreen"]);

  delete globalThis.window;
});

function createMockWindow(webApp) {
  return {
    Telegram: {
      WebApp: webApp
    },
    location: {
      lastReplace: null,
      replace(url) {
        this.lastReplace = url;
      },
      search: ""
    }
  };
}

function createMockWebApp({ platform = "ios", viewportStableHeight = 620 } = {}) {
  const listeners = new Map();

  const webApp = {
    close() {},
    colorScheme: "light",
    expand() {
      webApp.viewportHeight = 780;
      webApp.viewportStableHeight = 780;
      emit("viewportChanged");
    },
    initData: "query_id=test&user=%7B%22id%22%3A1%2C%22first_name%22%3A%22Aj%22%7D",
    initDataUnsafe: {
      query_id: "test",
      user: {
        first_name: "Aj",
        id: 1
      }
    },
    isExpanded: viewportStableHeight >= 720,
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
    platform,
    ready() {},
    sendData() {},
    showAlert() {},
    showConfirm() {},
    showPopup() {},
    themeParams: {
      bg_color: "#ffffff",
      button_color: "#2481cc",
      button_text_color: "#ffffff",
      hint_color: "#7d8b99",
      link_color: "#2481cc",
      secondary_bg_color: "#eef2f5",
      text_color: "#101820"
    },
    version: "8.0",
    viewportHeight: viewportStableHeight,
    viewportStableHeight
  };

  function emit(event) {
    webApp.isExpanded = webApp.viewportStableHeight >= 720;
    for (const callback of listeners.get(event) ?? []) {
      callback();
    }
  }

  return webApp;
}
