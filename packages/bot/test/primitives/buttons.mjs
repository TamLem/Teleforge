import assert from "node:assert/strict";
import test from "node:test";

import { createMiniAppButton } from "../../dist/index.js";

test("createMiniAppButton encodes launch hints into the Mini App URL", () => {
  const button = createMiniAppButton({
    requestWriteAccess: true,
    startPayload: "signed-flow-token",
    stayInChat: true,
    text: "Open Task Shop",
    webAppUrl: "https://example.ngrok.app/shop?view=home"
  });

  assert.equal(button.text, "Open Task Shop");
  assert.equal(button.callback_data, undefined);

  const url = new URL(button.web_app.url);
  assert.equal(url.searchParams.get("view"), "home");
  assert.equal(url.searchParams.get("tgWebAppStartParam"), "signed-flow-token");
  assert.equal(url.searchParams.get("tfRequestWriteAccess"), "1");
  assert.equal(url.searchParams.get("tfStayInChat"), "1");
});
