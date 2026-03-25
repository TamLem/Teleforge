import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { BackButton } from "../dist/index.js";

test("syncs Telegram BackButton visibility and renders a fallback button", async () => {
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
      React.createElement(BackButton, {
        onClick: () => {
          clicks += 1;
        },
        visible: true
      })
    );
  });

  const button = renderer.root.findByProps({ className: "tf-back-button" });

  assert.equal(webApp.BackButton.isVisible, true);

  await act(async () => {
    button.props.onClick();
  });

  assert.equal(clicks, 1);

  await act(async () => {
    renderer.unmount();
  });

  delete globalThis.window;
});

test("supports haptic feedback and hiding", async () => {
  const webApp = createMockWebApp();
  let renderer;

  globalThis.window = {
    Telegram: {
      WebApp: webApp
    }
  };

  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(BackButton, {
        haptic: "light",
        onClick() {},
        visible: true
      })
    );
  });

  const button = renderer.root.findByProps({ className: "tf-back-button" });

  await act(async () => {
    button.props.onClick();
  });

  assert.deepEqual(webApp.HapticFeedback.impacts, ["light"]);

  await act(async () => {
    renderer.update(
      React.createElement(BackButton, {
        haptic: "light",
        onClick() {},
        visible: false
      })
    );
  });

  assert.equal(webApp.BackButton.isVisible, false);

  await act(async () => {
    renderer.unmount();
  });

  delete globalThis.window;
});

function createMockWebApp() {
  const clickHandlers = new Set();

  return {
    BackButton: {
      hide() {
        this.isVisible = false;
      },
      isVisible: false,
      offClick(callback) {
        clickHandlers.delete(callback);
      },
      onClick(callback) {
        clickHandlers.add(callback);
      },
      show() {
        this.isVisible = true;
      },
      triggerClick() {
        for (const callback of clickHandlers) {
          callback();
        }
      }
    },
    HapticFeedback: {
      impactOccurred(style) {
        this.impacts.push(style);
      },
      impacts: [],
      notificationOccurred() {},
      selectionChanged() {}
    },
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
