import assert from "node:assert/strict";
import test from "node:test";

import { BffRouteError, enforceBffAuth } from "../../dist/index.js";

test("enforceBffAuth rejects required routes without Telegram auth", () => {
  let status = 200;

  assert.throws(
    () =>
      enforceBffAuth("required", {
        headers: new Headers(),
        launchMode: "compact",
        method: "GET",
        path: "/secure",
        searchParams: new URLSearchParams(),
        setHeader() {},
        setStatus(code) {
          status = code;
        }
      }),
    (error) => error instanceof BffRouteError && error.code === "UNAUTHENTICATED"
  );

  assert.equal(status, 401);
});

test("enforceBffAuth allows optional routes without Telegram auth", () => {
  enforceBffAuth("optional", {
    headers: new Headers(),
    launchMode: "compact",
    method: "GET",
    path: "/secure",
    searchParams: new URLSearchParams(),
    setHeader() {},
    setStatus() {}
  });

  assert.equal(true, true);
});
