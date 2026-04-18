import assert from "node:assert/strict";
import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { loadManifest } from "../dist/index.js";

test("loadManifest supports teleforge.config.ts deriving routes from imported flows", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-devtools-manifest-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const handlersRoot = path.join(tmpRoot, "apps", "bot", "src", "flow-handlers", "start");
  const serverHooksRoot = path.join(tmpRoot, "apps", "api", "src", "flow-hooks", "start");
  const screensRoot = path.join(tmpRoot, "apps", "web", "src", "screens");
  const nodeModulesRoot = path.join(tmpRoot, "node_modules");
  const teleforgeIndexUrl = pathToFileURL(
    path.resolve(process.cwd(), "..", "teleforge", "src", "index.ts")
  ).href;
  const teleforgePackagePath = path.resolve(
    process.cwd(),
    "..",
    "..",
    "examples",
    "starter-app",
    "node_modules",
    "teleforge"
  );

  await mkdir(flowsRoot, { recursive: true });
  await mkdir(handlersRoot, { recursive: true });
  await mkdir(serverHooksRoot, { recursive: true });
  await mkdir(screensRoot, { recursive: true });
  await mkdir(nodeModulesRoot, { recursive: true });
  await symlink(teleforgePackagePath, path.join(nodeModulesRoot, "teleforge"), "dir");
  await writeFile(
    path.join(flowsRoot, "start.flow.ts"),
    `import { defineFlow } from ${JSON.stringify(teleforgeIndexUrl)};

export default defineFlow({
  id: "start",
  initialStep: "welcome",
  state: {},
  bot: {
    command: {
      command: "start",
      description: "Open app",
      text: "Open app"
    }
  },
  miniApp: {
    component: "pages/Home",
    launchModes: ["inline", "compact", "fullscreen"],
    route: "/"
  },
  steps: {
    welcome: {
      actions: [
        {
          label: "Open app",
          to: "home"
        },
        {
          id: "help",
          label: "Help"
        },
        {
          id: "cancel",
          label: "Cancel"
        }
      ],
      message: "Welcome",
      onEnter() {
        return {};
      },
      type: "chat"
    },
    home: {
      screen: "home",
      type: "miniapp"
    }
  }
});
`
  );
  await writeFile(
    path.join(handlersRoot, "welcome.ts"),
    `export const actions = {
  help() {
    return {};
  }
};
`
  );
  await writeFile(
    path.join(handlersRoot, "home.ts"),
    `export default {
  onSubmit() {
    return {};
  }
};
`
  );
  await writeFile(
    path.join(serverHooksRoot, "home.ts"),
    `export function guard() {
  return true;
}

export function loader() {
  return {
    heading: "Authoritative Home"
  };
}
`
  );
  await writeFile(
    path.join(screensRoot, "home.screen.tsx"),
    `import { defineScreen } from "teleforge/web";

export default defineScreen({
  component() {
    return null;
  },
  id: "home",
  title: "Home"
});
`
  );
  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from ${JSON.stringify(teleforgeIndexUrl)};

export default defineTeleforgeApp({
  app: {
    id: "devtools-flow-app",
    name: "Devtools Flow App",
    version: "1.0.0"
  },
  flows: {
    root: "apps/bot/src/flows",
    serverHooksRoot: "apps/api/src/flow-hooks"
  },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "devtools_flow_bot",
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
  runtime: {
    mode: "spa",
    webFramework: "vite"
  }
});
`
  );

  const loaded = await loadManifest(tmpRoot);

  assert.equal(loaded.manifest.id, "devtools-flow-app");
  assert.equal(loaded.discoveredFlows.length, 1);
  assert.equal(loaded.discoveredFlows[0]?.id, "start");
  assert.equal(loaded.discoveredFlows[0]?.route, "/");
  assert.equal(loaded.discoveredFlows[0]?.command, "start");
  assert.equal(loaded.discoveredFlows[0]?.stepCount, 2);
  assert.equal(loaded.discoveredFlows[0]?.hasRuntimeHandlers, true);
  assert.equal(loaded.discoveredFlows[0]?.hasWiringGaps, true);
  assert.equal(loaded.discoveredFlows[0]?.warningStepCount, 1);
  assert.equal(loaded.discoveredFlows[0]?.wiredStepCount, 1);
  assert.equal(loaded.discoveredFlows[0]?.passiveStepCount, 0);
  assert.equal(loaded.discoveredFlows[0]?.steps[0]?.id, "welcome");
  assert.equal(loaded.discoveredFlows[0]?.steps[0]?.status, "warning");
  assert.deepEqual(loaded.discoveredFlows[0]?.steps[0]?.unresolvedActionIds, ["cancel"]);
  assert.equal(loaded.discoveredFlows[0]?.steps[0]?.actions[0]?.resolution, "transition");
  assert.equal(loaded.discoveredFlows[0]?.steps[0]?.actions[1]?.resolution, "handler");
  assert.equal(loaded.discoveredFlows[0]?.steps[1]?.status, "wired");
  assert.equal(loaded.discoveredFlows[0]?.steps[1]?.resolvedOnSubmit, true);
  assert.equal(loaded.discoveredFlows[0]?.steps[1]?.resolvedServerGuard, true);
  assert.equal(loaded.discoveredFlows[0]?.steps[1]?.resolvedServerLoader, true);
  assert.match(loaded.discoveredFlows[0]?.steps[1]?.serverHookFile ?? "", /home\.ts$/);
  assert.equal(loaded.discoveredFlows[0]?.steps[1]?.screenResolved, true);
  assert.equal(loaded.discoveredFlows[0]?.steps[1]?.screenTitle, "Home");
  assert.match(loaded.discoveredFlows[0]?.steps[1]?.screenFilePath ?? "", /home\.screen\.tsx$/);
  assert.equal(loaded.manifest.routes.length, 1);
  assert.equal(loaded.manifest.routes[0]?.path, "/");
  assert.equal(loaded.manifest.routes[0]?.component, "pages/Home");
  assert.equal(loaded.manifest.routes[0]?.coordination?.flow?.flowId, "start");
});
