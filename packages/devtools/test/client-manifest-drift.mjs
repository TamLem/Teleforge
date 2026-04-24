import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  checkClientManifestDrift,
  readClientManifestFlowIds
} from "../dist/utils/client-manifest-drift.js";

test("readClientManifestFlowIds returns null when manifest is missing", async () => {
  const ids = await readClientManifestFlowIds("/nonexistent/manifest.ts");
  assert.equal(ids, null);
});

test("readClientManifestFlowIds extracts top-level flow IDs from generated manifest", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-drift-"));
  const manifestPath = path.join(tmpDir, "client-flow-manifest.ts");

  await writeFile(
    manifestPath,
    `import { defineClientFlowManifest } from "teleforge/web";

export const flowManifest = defineClientFlowManifest(
  [
    {
      "id": "start",
      "initialStep": "welcome",
      "steps": {
        "welcome": {
          "type": "chat",
          "actions": [
            {
              "id": "open-app",
              "label": "Open app"
            }
          ]
        }
      }
    },
    {
      "id": "checkout",
      "initialStep": "cart",
      "steps": {
        "cart": {
          "type": "miniapp",
          "screen": "checkout.cart"
        }
      }
    }
  ]
);
`,
    "utf8"
  );

  const ids = await readClientManifestFlowIds(manifestPath);
  assert.deepEqual(ids, ["start", "checkout"]);
});

test("readClientManifestFlowIds returns null for malformed manifest", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-drift-"));
  const manifestPath = path.join(tmpDir, "client-flow-manifest.ts");

  await writeFile(manifestPath, "not a manifest", "utf8");
  const ids = await readClientManifestFlowIds(manifestPath);
  assert.equal(ids, null);
});

test("readClientManifestFlowIds returns null when top-level entries are malformed", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-drift-"));
  const manifestPath = path.join(tmpDir, "client-flow-manifest.ts");

  await writeFile(
    manifestPath,
    `import { defineClientFlowManifest } from "teleforge/web";

export const flowManifest = defineClientFlowManifest(
  [{ "id": "start" }, { "name": "broken" }]
);
`,
    "utf8"
  );
  const ids = await readClientManifestFlowIds(manifestPath);
  assert.equal(ids, null);
});

test("checkClientManifestDrift passes when manifest is in sync", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-drift-"));
  const manifestPath = path.join(tmpDir, "client-flow-manifest.ts");

  await writeFile(
    manifestPath,
    `import { defineClientFlowManifest } from "teleforge/web";\n\nexport const flowManifest = defineClientFlowManifest(\n  [{ "id": "start" }, { "id": "checkout" }]\n);\n`,
    "utf8"
  );

  const drift = await checkClientManifestDrift({
    discoveredFlows: [{ id: "start" }, { id: "checkout" }],
    manifestPath
  });

  assert.equal(drift.isStale, false);
});

test("checkClientManifestDrift detects missing flow in manifest", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-drift-"));
  const manifestPath = path.join(tmpDir, "client-flow-manifest.ts");

  await writeFile(
    manifestPath,
    `import { defineClientFlowManifest } from "teleforge/web";\n\nexport const flowManifest = defineClientFlowManifest(\n  [{ "id": "start" }]\n);\n`,
    "utf8"
  );

  const drift = await checkClientManifestDrift({
    discoveredFlows: [{ id: "start" }, { id: "checkout" }],
    manifestPath
  });

  assert.equal(drift.isStale, true);
  assert.match(drift.reason, /checkout.*missing from manifest/);
});

test("checkClientManifestDrift detects stale flow in manifest", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-drift-"));
  const manifestPath = path.join(tmpDir, "client-flow-manifest.ts");

  await writeFile(
    manifestPath,
    `import { defineClientFlowManifest } from "teleforge/web";\n\nexport const flowManifest = defineClientFlowManifest(\n  [{ "id": "start" }, { "id": "old-flow" }]\n);\n`,
    "utf8"
  );

  const drift = await checkClientManifestDrift({
    discoveredFlows: [{ id: "start" }],
    manifestPath
  });

  assert.equal(drift.isStale, true);
  assert.match(drift.reason, /stale flow "old-flow"/);
});

test("checkClientManifestDrift detects missing manifest file", async () => {
  const drift = await checkClientManifestDrift({
    discoveredFlows: [{ id: "start" }],
    manifestPath: "/nonexistent/manifest.ts"
  });

  assert.equal(drift.isStale, true);
  assert.match(drift.reason, /missing/);
});

test("checkClientManifestDrift treats malformed top-level entries as unreadable", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-drift-"));
  const manifestPath = path.join(tmpDir, "client-flow-manifest.ts");

  await writeFile(
    manifestPath,
    `import { defineClientFlowManifest } from "teleforge/web";

export const flowManifest = defineClientFlowManifest(
  [{ "id": "start" }, { "name": "broken" }]
);
`,
    "utf8"
  );

  const drift = await checkClientManifestDrift({
    discoveredFlows: [{ id: "start" }],
    manifestPath
  });

  assert.equal(drift.isStale, true);
  assert.match(drift.reason ?? "", /missing or unreadable/);
});

test("checkClientManifestDrift skips when no flows are discovered", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-drift-"));
  const manifestPath = path.join(tmpDir, "client-flow-manifest.ts");

  await writeFile(
    manifestPath,
    `import { defineClientFlowManifest } from "teleforge/web";\n\nexport const flowManifest = defineClientFlowManifest(\n  [{ "id": "start" }]\n);\n`,
    "utf8"
  );

  const drift = await checkClientManifestDrift({
    discoveredFlows: [],
    manifestPath
  });

  assert.equal(drift.isStale, false);
});
