import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { SettingsItem, SettingsSection } from "../dist/index.js";

test("renders navigation, value, and destructive button variants", async () => {
  const webApp = createMockWebApp();
  let clicked = 0;
  let renderer;

  globalThis.window = {
    Telegram: {
      WebApp: webApp
    }
  };

  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(
        SettingsSection,
        {
          footer: "Manage how your account behaves.",
          title: "Account"
        },
        React.createElement(SettingsItem, {
          icon: "👤",
          onClick: () => {
            clicked += 1;
          },
          title: "Profile",
          variant: "navigation"
        }),
        React.createElement(SettingsItem, {
          subtitle: "Current app language",
          title: "Language",
          value: "English",
          variant: "value"
        }),
        React.createElement(SettingsItem, {
          destructive: true,
          onClick: () => {
            clicked += 1;
          },
          title: "Delete Account",
          variant: "button"
        })
      )
    );
  });

  const rows = renderer.root.findAllByProps({ className: "tf-settings-item" });

  assert.equal(rows.length, 3);
  assert.match(JSON.stringify(renderer.toJSON()), /Account/);
  assert.match(JSON.stringify(renderer.toJSON()), /English/);

  await act(async () => {
    rows[0].props.onClick();
    rows[2].props.onClick();
  });

  assert.equal(clicked, 2);

  delete globalThis.window;
});

test("renders toggle variant and calls onChange", async () => {
  const webApp = createMockWebApp();
  let checked = false;
  let renderer;

  globalThis.window = {
    Telegram: {
      WebApp: webApp
    }
  };

  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(SettingsItem, {
        checked,
        onChange(nextChecked) {
          checked = nextChecked;
        },
        subtitle: "Order updates and reminders",
        title: "Notifications",
        variant: "toggle"
      })
    );
  });

  const toggle = renderer.root.findByProps({ className: "tf-settings-toggle" });

  await act(async () => {
    toggle.props.onClick({
      stopPropagation() {}
    });
  });

  assert.equal(checked, true);

  delete globalThis.window;
});

function createMockWebApp() {
  return {
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
