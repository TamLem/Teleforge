import test from "node:test";
import assert from "node:assert/strict";
import {
  detectLaunchMode,
  parseInitData,
  parseInitDataUnsafe,
  parseLaunchContext,
  validateLaunchAgainstManifest
} from "../dist/index.js";

const manifest = {
  id: "sample-app",
  name: "Sample App",
  version: "1.0.0",
  runtime: {
    mode: "spa",
    webFramework: "vite"
  },
  bot: {
    username: "sample_bot",
    tokenEnv: "BOT_TOKEN",
    webhook: {
      path: "/api/webhook",
      secretEnv: "BOT_WEBHOOK_SECRET"
    }
  },
  miniApp: {
    entryPoint: "apps/web/src/main.tsx",
    launchModes: ["inline", "compact", "fullscreen"],
    defaultMode: "inline",
    capabilities: ["read_access", "payments"]
  },
  routes: [
    {
      path: "/"
    }
  ]
};

test("parses valid initData from URL params and extracts launch context", () => {
  const initData = new URLSearchParams({
    auth_date: "1710000000",
    hash: "deadbeef",
    query_id: "query-123",
    start_param: "checkout",
    user: JSON.stringify({
      id: 42,
      first_name: "Dev",
      username: "teleforge_dev",
      allows_write_to_pm: true
    })
  }).toString();
  const params = new URLSearchParams({
    tgWebAppData: initData,
    tgWebAppPlatform: "ios",
    tgWebAppVersion: "7.2",
    tgWebAppViewportHeight: "640"
  });

  const context = parseLaunchContext(params);

  assert.equal(context.platform, "ios");
  assert.equal(context.launchMode, "compact");
  assert.equal(context.mode, "compact");
  assert.equal(context.startParam, "checkout");
  assert.equal(context.startParamRaw, "checkout");
  assert.equal(context.user?.id, 42);
  assert.equal(context.hash, "deadbeef");
  assert.equal(context.authDate?.toISOString(), "2024-03-09T16:00:00.000Z");
  assert.equal(context.capabilities.supportsPayments, true);
  assert.equal(context.capabilities.supportsHapticFeedback, true);
  assert.equal(context.capabilities.supportsReadAccess, true);
  assert.equal(context.capabilities.supportsWriteAccess, true);
});

test("parseInitData parses structured fields and parseInitDataUnsafe ignores malformed JSON", () => {
  const validInitData = new URLSearchParams({
    auth_date: "1710000000",
    hash: "abc123",
    receiver: JSON.stringify({
      id: 7,
      first_name: "Receiver"
    }),
    user: JSON.stringify({
      id: 42,
      first_name: "Dev"
    })
  }).toString();

  const validResult = parseInitData(validInitData);
  assert.equal(validResult.success, true);
  if (validResult.success) {
    assert.equal(validResult.data.receiver?.id, 7);
    assert.equal(validResult.data.user?.first_name, "Dev");
  }

  const invalidResult = parseInitData("user=%7Bbad-json&auth_date=oops");
  assert.equal(invalidResult.success, false);
  if (!invalidResult.success) {
    assert.match(invalidResult.error, /Invalid user JSON|Invalid auth_date/);
  }

  const unsafe = parseInitDataUnsafe("user=%7Bbad-json&auth_date=oops");
  assert.deepEqual(unsafe, {});
});

test("detectLaunchMode infers launch modes from viewport height and platform", () => {
  assert.equal(detectLaunchMode(180, "ios"), "inline");
  assert.equal(detectLaunchMode(480, "ios"), "compact");
  assert.equal(detectLaunchMode(480, "desktop"), "fullscreen");
  assert.equal(detectLaunchMode(760, "android"), "fullscreen");
});

test("parseLaunchContext handles missing initData and platform fallbacks safely", () => {
  const context = parseLaunchContext("tgWebAppPlatform=web&tgWebAppVersion=8.0");

  assert.equal(context.initData, "");
  assert.equal(context.user, null);
  assert.equal(context.launchMode, "fullscreen");
  assert.equal(context.canExpand, false);
  assert.equal(context.capabilities.supportsFullscreen, true);
  assert.equal(context.capabilities.supportsCloudStorage, true);
});

test("parseLaunchContext honors explicit launch mode and startapp params", () => {
  const context = parseLaunchContext(
    "launchMode=inline&startapp=settings&tgWebAppPlatform=android&tgWebAppVersion=7.0"
  );

  assert.equal(context.launchMode, "inline");
  assert.equal(context.startParam, "settings");
  assert.equal(context.startParamRaw, "settings");
  assert.equal(context.isInline, true);
  assert.equal(context.canExpand, true);
});

test("validateLaunchAgainstManifest accepts supported contexts and rejects unsupported launch modes", () => {
  const validContext = parseLaunchContext(
    new URLSearchParams({
      launchMode: "inline",
      tgWebAppPlatform: "ios",
      tgWebAppVersion: "7.2",
      tgWebAppData: new URLSearchParams({
        auth_date: "1710000000",
        hash: "ok",
        user: JSON.stringify({
          id: 42,
          first_name: "Dev"
        })
      }).toString()
    })
  );

  assert.deepEqual(validateLaunchAgainstManifest({ context: validContext, manifest }), {
    valid: true
  });

  const invalidContext = parseLaunchContext(
    "launchMode=unknown&tgWebAppPlatform=unknown&tgWebAppVersion=6.0"
  );

  const invalidResult = validateLaunchAgainstManifest({
    context: invalidContext,
    manifest: {
      ...manifest,
      miniApp: {
        ...manifest.miniApp,
        capabilities: ["write_access"],
        launchModes: ["fullscreen"]
      }
    }
  });

  assert.equal(invalidResult.valid, false);
  if (!invalidResult.valid) {
    assert.match(invalidResult.errors.join("\n"), /Unable to determine launch mode/);
    assert.match(invalidResult.errors.join("\n"), /write_access/);
  }
});
