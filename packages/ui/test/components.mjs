import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import TestRenderer, { act } from "react-test-renderer";
import {
  TgButton,
  TgCard,
  TgInput,
  TgList,
  TgSpinner,
  TgText,
  useThemeColors
} from "../dist/index.js";

test("renders theme-aware primitives on the server", () => {
  const previousWindow = globalThis.window;
  delete globalThis.window;

  const html = renderToString(
    React.createElement(
      TgCard,
      null,
      React.createElement(
        TgText,
        {
          variant: "title"
        },
        "Profile"
      ),
      React.createElement(TgButton, null, "Save"),
      React.createElement(TgSpinner, null)
    )
  );

  assert.match(html, /Profile/);
  assert.match(html, /Save/);

  if (previousWindow) {
    globalThis.window = previousWindow;
  }
});

test("useThemeColors exposes current Telegram theme values", async () => {
  const webApp = createMockWebApp();
  let colors;

  globalThis.window = {
    Telegram: {
      WebApp: webApp
    }
  };

  function Probe() {
    colors = useThemeColors();
    return null;
  }

  await act(async () => {
    TestRenderer.create(React.createElement(Probe));
  });

  assert.equal(colors.buttonColor, "#2481cc");
  assert.equal(colors.textColor, "#101820");

  delete globalThis.window;
});

test("renders buttons, input, list selection, and spinner states", async () => {
  const webApp = createMockWebApp();
  let renderer;
  let inputValue = "Alice";
  let selected = "plan-pro";

  globalThis.window = {
    Telegram: {
      WebApp: webApp
    }
  };

  function Demo() {
    return React.createElement(
      "div",
      null,
      React.createElement(
        TgButton,
        {
          loading: true,
          variant: "secondary"
        },
        "Submitting"
      ),
      React.createElement(TgInput, {
        onChange: (value) => {
          inputValue = value;
        },
        placeholder: "Display name",
        value: inputValue
      }),
      React.createElement(TgList, {
        items: [
          {
            id: "plan-basic",
            label: "Basic"
          },
          {
            description: "Recommended",
            id: "plan-pro",
            label: "Pro"
          }
        ],
        onSelect: (id) => {
          selected = id;
        },
        selected
      })
    );
  }

  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Demo));
  });

  const buttons = renderer.root.findAllByType("button");
  const input = renderer.root.findByType("input");

  assert.equal(buttons[0].props.disabled, true);
  assert.equal(buttons[0].children.includes("Submitting"), true);

  await act(async () => {
    input.props.onChange({
      target: {
        value: "Bob"
      }
    });
  });

  assert.equal(inputValue, "Bob");

  await act(async () => {
    buttons[2].props.onClick();
  });

  assert.equal(selected, "plan-pro");

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
