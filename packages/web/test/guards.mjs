import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import TestRenderer, { act } from "react-test-renderer";
import {
  CapabilityGuard,
  ManifestProvider,
  useManifestGuard,
  useRouteGuard,
  withRouteGuard
} from "../dist/index.js";

const manifest = {
  bot: {
    commands: [],
    tokenEnv: "BOT_TOKEN",
    username: "guard_bot",
    webhook: {
      path: "/api/webhook",
      secretEnv: "WEBHOOK_SECRET"
    }
  },
  id: "guard-app",
  miniApp: {
    capabilities: ["read_access", "write_access"],
    defaultMode: "inline",
    entryPoint: "apps/web/src/main.tsx",
    launchModes: ["inline", "compact", "fullscreen"]
  },
  name: "Guard App",
  routes: [
    {
      guards: ["auth"],
      launchModes: ["compact", "fullscreen"],
      path: "/profile"
    },
    {
      capabilities: {
        payments: true
      },
      path: "/checkout"
    }
  ],
  runtime: {
    mode: "spa",
    webFramework: "vite"
  },
  version: "1.0.0"
};

test("useRouteGuard returns blocked state during SSR-safe launch initialization", () => {
  const previousWindow = globalThis.window;
  let snapshot;

  delete globalThis.window;

  function Probe() {
    snapshot = useRouteGuard({
      auth: true
    });
    return null;
  }

  renderToString(React.createElement(Probe));

  assert.equal(snapshot.allowed, false);
  assert.match(snapshot.reason, /not ready/i);

  if (previousWindow) {
    globalThis.window = previousWindow;
  }
});

test("useRouteGuard allows matching launch mode and capability requirements", async () => {
  const webApp = createMockWebApp();
  let snapshot;

  globalThis.window = {
    Telegram: {
      WebApp: webApp
    },
    location: {
      assign() {},
      search: "?startapp=checkout"
    }
  };

  function Probe() {
    snapshot = useRouteGuard({
      capabilities: ["payments"],
      launchMode: ["compact", "fullscreen"],
      startParam: "^checkout$"
    });
    return null;
  }

  await act(async () => {
    TestRenderer.create(React.createElement(Probe));
  });

  assert.deepEqual(snapshot, {
    allowed: true
  });

  delete globalThis.window;
});

test("useRouteGuard blocks auth and capability failures with redirect hints", async () => {
  const webApp = createMockWebApp({
    initData: "auth_date=1710000000&hash=abc",
    initDataUnsafe: {},
    version: "6.0"
  });
  let snapshot;

  globalThis.window = {
    Telegram: {
      WebApp: webApp
    },
    location: {
      assign() {},
      search: ""
    }
  };

  function Probe() {
    snapshot = useRouteGuard({
      auth: true,
      capabilities: ["payments"]
    });
    return null;
  }

  await act(async () => {
    TestRenderer.create(React.createElement(Probe));
  });

  assert.equal(snapshot.allowed, false);
  assert.equal(snapshot.redirectTo, "/login");

  delete globalThis.window;
});

test("useManifestGuard derives requirements from context-provided manifest", async () => {
  const webApp = createMockWebApp();
  let snapshot;

  globalThis.window = {
    Telegram: {
      WebApp: webApp
    },
    location: {
      assign() {},
      search: ""
    }
  };

  function Probe() {
    snapshot = useManifestGuard("/profile");
    return null;
  }

  await act(async () => {
    TestRenderer.create(
      React.createElement(
        ManifestProvider,
        {
          manifest
        },
        React.createElement(Probe)
      )
    );
  });

  assert.equal(snapshot.allowed, true);

  delete globalThis.window;
});

test("CapabilityGuard renders fallback or redirects when blocked", async () => {
  const webApp = createMockWebApp({
    initData: "auth_date=1710000000&hash=abc",
    initDataUnsafe: {}
  });
  const assigned = [];
  let renderer;

  globalThis.window = {
    Telegram: {
      WebApp: webApp
    },
    location: {
      assign(value) {
        assigned.push(value);
      },
      search: ""
    }
  };

  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(
        CapabilityGuard,
        {
          fallback: React.createElement("div", null, "blocked"),
          requirements: {
            auth: true
          }
        },
        React.createElement("div", null, "allowed")
      )
    );
  });

  assert.equal(renderer.toJSON().children[0], "blocked");
  assert.deepEqual(assigned, []);

  await act(async () => {
    renderer.update(
      React.createElement(
        CapabilityGuard,
        {
          redirectTo: "/login",
          requirements: {
            auth: true
          }
        },
        React.createElement("div", null, "allowed")
      )
    );
  });

  assert.deepEqual(assigned, ["/login"]);

  delete globalThis.window;
});

test("withRouteGuard wraps a component and renders when allowed", async () => {
  const webApp = createMockWebApp();
  let renderer;

  globalThis.window = {
    Telegram: {
      WebApp: webApp
    },
    location: {
      assign() {},
      search: ""
    }
  };

  function Screen({ label }) {
    return React.createElement("div", null, label);
  }

  const GuardedScreen = withRouteGuard(Screen, {
    launchMode: ["compact", "fullscreen"]
  });

  await act(async () => {
    renderer = TestRenderer.create(
      React.createElement(GuardedScreen, {
        label: "content"
      })
    );
  });

  assert.equal(renderer.toJSON().children[0], "content");

  delete globalThis.window;
});

function createMockWebApp(overrides = {}) {
  return {
    close() {},
    colorScheme: "light",
    expand() {},
    initData:
      "auth_date=1710000000&hash=abc&query_id=query-1&user=%7B%22id%22%3A42%2C%22first_name%22%3A%22Dev%22%2C%22username%22%3A%22teleforge_dev%22%7D",
    initDataUnsafe: {
      user: {
        first_name: "Dev",
        id: 42,
        username: "teleforge_dev"
      }
    },
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
    themeParams: {},
    version: "7.2",
    viewportHeight: 520,
    viewportStableHeight: 500,
    ...overrides
  };
}
