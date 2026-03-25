import assert from "node:assert/strict";
import test from "node:test";

import { BffRouteError, enforceLaunchModes } from "../../dist/index.js";

test("enforceLaunchModes rejects disallowed launch modes", () => {
  let status = 200;

  assert.throws(
    () =>
      enforceLaunchModes(["inline"], {
        headers: new Headers(),
        launchMode: "compact",
        method: "GET",
        path: "/profile",
        searchParams: new URLSearchParams(),
        setHeader() {},
        setStatus(code) {
          status = code;
        }
      }),
    (error) => error instanceof BffRouteError && error.code === "LAUNCH_MODE_NOT_ALLOWED"
  );

  assert.equal(status, 403);
});

test("enforceLaunchModes allows configured launch modes", () => {
  enforceLaunchModes(["compact", "fullscreen"], {
    headers: new Headers(),
    launchMode: "compact",
    method: "GET",
    path: "/profile",
    searchParams: new URLSearchParams(),
    setHeader() {},
    setStatus() {}
  });

  assert.equal(true, true);
});
