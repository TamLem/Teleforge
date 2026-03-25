import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { MainButton } from "../dist/index.js";

test("syncs Telegram MainButton state and renders a sticky fallback button", async () => {
  const webApp = createMockWebApp();
  let clicks = 0;
  let renderer;

  globalThis.window = {
    Telegram: {
      WebApp: webApp
    }
  };

  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(MainButton, {
        haptic: "medium",
        onClick: () => {
          clicks += 1;
        },
        progress: 48,
        text: "Continue"
      })
    );
  });

  const shell = renderer.root.findByProps({ className: "tf-main-button-shell" });
  const button = renderer.root.findByProps({ className: "tf-main-button" });

  assert.equal(webApp.MainButton.text, "Continue");
  assert.equal(webApp.MainButton.isVisible, true);
  assert.equal(webApp.MainButton.isActive, true);
  assert.equal(shell.props.style.position, "sticky");
  assert.equal(button.props.style.backgroundColor, "#2481cc");

  await act(async () => {
    button.props.onClick();
  });

  assert.equal(clicks, 1);
  assert.deepEqual(webApp.HapticFeedback.impacts, ["medium"]);

  await act(async () => {
    renderer.unmount();
  });

  delete globalThis.window;
});

test("supports haptic, loading, disabled, and destructive states", async () => {
  const webApp = createMockWebApp();
  let renderer;

  globalThis.window = {
    Telegram: {
      WebApp: webApp
    }
  };

  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(MainButton, {
        destructive: true,
        disabled: true,
        haptic: "heavy",
        loading: true,
        onClick() {},
        text: "Delete"
      })
    );
  });

  const button = renderer.root.findByProps({ className: "tf-main-button" });

  assert.equal(button.props.disabled, true);
  assert.equal(button.props.style.backgroundColor, "#ff3b30");
  assert.equal(webApp.MainButton.isActive, false);
  assert.equal(webApp.MainButton.isProgressVisible, true);

  await act(async () => {
    button.props.onClick();
  });

  assert.deepEqual(webApp.HapticFeedback.impacts, []);

  await act(async () => {
    renderer.unmount();
  });

  delete globalThis.window;
});

function createMockWebApp() {
  const clickHandlers = new Set();

  const mainButton = {
    color: "",
    disable() {
      this.isActive = false;
    },
    enable() {
      this.isActive = true;
    },
    hide() {
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
    textColor: ""
  };

  return {
    HapticFeedback: {
      impactOccurred(style) {
        this.impacts.push(style);
      },
      impacts: [],
      notificationOccurred() {},
      selectionChanged() {}
    },
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
    themeParams: {
      bg_color: "#ffffff",
      button_color: "#2481cc",
      button_text_color: "#ffffff",
      destructive_text_color: "#ff3b30",
      hint_color: "#7d8b99",
      link_color: "#2481cc",
      secondary_bg_color: "#eef2f5",
      text_color: "#101820"
    },
    version: "7.2",
    viewportHeight: 640,
    viewportStableHeight: 620
  };
}
