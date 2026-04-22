import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { generateClientManifest } from "../dist/index.js";

test("generateClientManifest writes a stripped client-safe manifest from discovered flows", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-generate-manifest-"));
  const flowsRoot = path.join(tmpRoot, "apps", "bot", "src", "flows");
  const nodeModulesRoot = path.join(tmpRoot, "node_modules");
  const teleforgePackagePath = path.resolve(
    process.cwd(),
    "..",
    "..",
    "examples",
    "starter-app",
    "node_modules",
    "teleforge"
  );
  const teleforgeIndexUrl = pathToFileURL(
    path.resolve(process.cwd(), "..", "teleforge", "src", "index.ts")
  ).href;

  await mkdir(flowsRoot, { recursive: true });
  await mkdir(nodeModulesRoot, { recursive: true });
  await symlink(teleforgePackagePath, path.join(nodeModulesRoot, "teleforge"), "dir");
  const tsxPath = path.resolve(
    process.cwd(),
    "..",
    "..",
    "node_modules",
    ".pnpm",
    "tsx@4.21.0",
    "node_modules",
    "tsx"
  );
  await symlink(tsxPath, path.join(nodeModulesRoot, "tsx"), "dir");

  await writeFile(
    path.join(tmpRoot, "teleforge.config.ts"),
    `import { defineTeleforgeApp } from "teleforge";

export default defineTeleforgeApp({
  app: { id: "generate-test", name: "Generate Test", version: "1.0.0" },
  flows: { root: "apps/bot/src/flows" },
  miniApp: {
    entry: "apps/web/src/main.tsx",
    launchModes: ["inline"],
    defaultMode: "inline"
  }
});
`
  );

  await writeFile(
    path.join(flowsRoot, "start.flow.ts"),
    `import { defineFlow } from ${JSON.stringify(teleforgeIndexUrl)};

export default defineFlow({
  id: "start",
  initialStep: "home",
  state: { visited: false },
  bot: {
    command: {
      buttonText: "Open Test",
      command: "start",
      description: "Start",
      text: "Welcome"
    }
  },
  miniApp: {
    launchModes: ["inline", "compact", "fullscreen"],
    route: "/"
  },
  steps: {
    home: {
      screen: "home",
      type: "miniapp"
    }
  }
});
`
  );

  const outputPath = path.join(tmpRoot, "apps", "web", "src", "teleforge-generated", "client-flow-manifest.ts");
  const resultPath = await generateClientManifest({ cwd: tmpRoot, outputPath });

  assert.equal(resultPath, outputPath);

  const content = await readFile(outputPath, "utf8");
  assert.match(content, /import { defineClientFlowManifest } from "teleforge\/web"/);
  assert.match(content, /export const flowManifest = defineClientFlowManifest/);
  assert.match(content, /"id": "start"/);
  assert.match(content, /"screen": "home"/);
  assert.match(content, /"type": "miniapp"/);

  assert.doesNotMatch(content, /onEnter/);
  assert.doesNotMatch(content, /handler/);
  assert.doesNotMatch(content, /loader/);
  assert.doesNotMatch(content, /guard/);
});
