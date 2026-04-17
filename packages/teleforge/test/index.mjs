import assert from "node:assert/strict";
import test from "node:test";

import { defineFlow, defineTeleforgeApp, teleforgeAppToManifest } from "../dist/index.js";

test("defineTeleforgeApp preserves config and converts it to a manifest", () => {
  const app = defineTeleforgeApp({
    app: {
      id: "sample-app",
      name: "Sample App",
      version: "1.0.0"
    },
    bot: {
      username: "sample_bot",
      tokenEnv: "BOT_TOKEN",
      webhook: {
        path: "/api/webhook",
        secretEnv: "WEBHOOK_SECRET"
      }
    },
    miniApp: {
      capabilities: ["read_access"],
      defaultMode: "inline",
      entry: "apps/web/src/main.tsx",
      launchModes: ["inline", "compact", "fullscreen"]
    },
    routes: [
      {
        path: "/"
      }
    ],
    runtime: {
      mode: "spa",
      webFramework: "vite"
    }
  });

  const manifest = teleforgeAppToManifest(app);
  assert.equal(manifest.id, "sample-app");
  assert.equal(manifest.name, "Sample App");
  assert.equal(manifest.miniApp.entryPoint, "apps/web/src/main.tsx");
});

test("defineFlow preserves flow metadata", () => {
  const flow = defineFlow({
    id: "order",
    initialStep: "welcome",
    state: {},
    steps: {
      welcome: {
        message: "Welcome",
        type: "chat"
      }
    }
  });

  assert.equal(flow.id, "order");
  assert.equal(flow.steps.welcome.type, "chat");
});
