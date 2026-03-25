import assert from "node:assert/strict";

export function assertMessageIncludes(text: string, expected: string) {
  assert.match(text, new RegExp(escapeRegExp(expected)));
}

export function assertWebAppButton(
  message: {
    options?: {
      reply_markup?: {
        inline_keyboard: Array<Array<{ text: string; web_app?: { url: string } }>>;
      };
    };
  },
  expectedText: string
) {
  const button = message.options?.reply_markup?.inline_keyboard?.[0]?.[0];

  assert.ok(button, "Expected an inline keyboard button.");
  assert.equal(button.text, expectedText);
  assert.ok(button.web_app?.url, "Expected a web_app URL.");
}

export function assertQueryParam(urlValue: string, key: string, expectedValue?: string) {
  const url = new URL(urlValue);
  const actual = url.searchParams.get(key);

  assert.ok(actual, `Expected query param "${key}".`);

  if (typeof expectedValue === "string") {
    assert.equal(actual, expectedValue);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
