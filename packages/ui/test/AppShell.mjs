import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import TestRenderer, { act } from "react-test-renderer";
import { AppShell } from "../dist/index.js";

test("renders children and SSR-safe defaults", () => {
  const previousWindow = globalThis.window;
  delete globalThis.window;

  const html = renderToString(
    React.createElement(AppShell, null, React.createElement("p", null, "Hello"))
  );

  assert.match(html, /Hello/);
  assert.match(html, /min-height:100vh/);

  if (previousWindow) {
    globalThis.window = previousWindow;
  }
});

test("renders header and back button callback", async () => {
  const webApp = createMockWebApp();
  let backClicks = 0;
  let renderer;

  globalThis.window = {
    Telegram: {
      WebApp: webApp
    }
  };

  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(
        AppShell,
        {
          header: {
            onBackClick: () => {
              backClicks += 1;
            },
            showBackButton: true,
            title: "Checkout"
          }
        },
        React.createElement("p", null, "Body")
      )
    );
  });

  const button = renderer.root.findByType("button");
  await act(async () => {
    button.props.onClick();
  });

  assert.equal(backClicks, 1);

  await act(async () => {
    renderer.unmount();
  });

  delete globalThis.window;
});

test("applies theme variables, viewport height, and main button integration", async () => {
  const webApp = createMockWebApp();
  let mainButtonClicks = 0;
  let renderer;

  globalThis.window = {
    Telegram: {
      WebApp: webApp
    }
  };

  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(
        AppShell,
        {
          mainButton: {
            loading: true,
            onClick: () => {
              mainButtonClicks += 1;
            },
            text: "PAY NOW",
            visible: true
          }
        },
        React.createElement("p", null, "Checkout")
      )
    );
  });

  const shell = renderer.root.findByProps({ className: "tf-app-shell" });
  const content = renderer.root.findByProps({ className: "tf-app-shell-content tf-padded" });

  assert.equal(shell.props.style.minHeight, "620px");
  assert.equal(shell.props.style["--tg-theme-bg-color"], "#101010");
  assert.equal(content.props.style.padding, "16px");
  assert.equal(webApp.MainButton.text, "PAY NOW");
  assert.equal(webApp.MainButton.isVisible, true);
  assert.equal(webApp.MainButton.isProgressVisible, true);

  webApp.MainButton.triggerClick();
  assert.equal(mainButtonClicks, 1);

  await act(async () => {
    renderer.unmount();
  });

  assert.equal(webApp.MainButton.hideCallCount > 0, true);

  delete globalThis.window;
});

function createMockWebApp() {
  const eventListeners = new Map();
  const clickHandlers = new Set();

  const mainButton = {
    color: "",
    disable() {
      this.isActive = false;
    },
    enable() {
      this.isActive = true;
    },
    hideCallCount: 0,
    hide() {
      this.hideCallCount += 1;
      this.isVisible = false;
    },
    hideProgress() {
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
    show() {
      this.isVisible = true;
    },
    showProgress() {
      this.isProgressVisible = true;
      this.isActive = false;
    },
    text: "",
    textColor: "",
    triggerClick() {
      for (const handler of clickHandlers) {
        handler();
      }
    }
  };

  return {
    MainButton: mainButton,
    close() {},
    colorScheme: "dark",
    expand() {},
    initData: "query_id=test",
    initDataUnsafe: {},
    isExpanded: false,
    offEvent(event, callback) {
      eventListeners.get(event)?.delete(callback);
    },
    onEvent(event, callback) {
      if (!eventListeners.has(event)) {
        eventListeners.set(event, new Set());
      }
      eventListeners.get(event).add(callback);
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
      link_color: "#2ea6ff",
      secondary_bg_color: "#1f1f1f",
      text_color: "#f5f5f5"
    },
    version: "7.2",
    viewportHeight: 640,
    viewportStableHeight: 620
  };
}
