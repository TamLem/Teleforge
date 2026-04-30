import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
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

test("readClientManifestFlowIds extracts flow IDs from 0.2 manifest shape", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-drift-"));
  const manifestPath = path.join(tmpDir, "client-flow-manifest.ts");

  await writeFile(
    manifestPath,
    `import { defineClientFlowManifest } from "teleforge/web";

export const flowManifest = defineClientFlowManifest(
  {
    "flows": [
      {
        "id": "start",
        "miniApp": {
          "routes": { "/": "welcome" },
          "defaultRoute": "/",
          "title": "Start Flow"
        },
        "screens": [
          {
            "id": "welcome",
            "route": "/",
            "actions": ["open-app"],
            "title": "Welcome",
            "requiresSession": false
          }
        ]
      },
      {
        "id": "checkout",
        "miniApp": {
          "routes": { "/checkout": "cart" },
          "defaultRoute": "/checkout"
        },
        "screens": [
          {
            "id": "cart",
            "route": "/checkout",
            "actions": [],
            "title": "Cart",
            "requiresSession": false
          }
        ]
      }
    ]
  }
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

test("readClientManifestFlowIds rejects old array manifest format", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-drift-"));
  const manifestPath = path.join(tmpDir, "client-flow-manifest.ts");

  // Old 0.1 format: array at top level instead of { flows: [...] }
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

test("readClientManifestFlowIds returns null when flows array has malformed entries", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-drift-"));
  const manifestPath = path.join(tmpDir, "client-flow-manifest.ts");

  await writeFile(
    manifestPath,
    `import { defineClientFlowManifest } from "teleforge/web";

export const flowManifest = defineClientFlowManifest(
  {
    "flows": [
      { "id": "start" },
      { "name": "broken" }
    ]
  }
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
  const contractsPath = path.join(tmpDir, "contracts.ts");

  await writeFile(
    manifestPath,
    `import { defineClientFlowManifest } from "teleforge/web";\n\nexport const flowManifest = defineClientFlowManifest(\n  {\n    "flows": [\n      { "id": "start", "screens": [] },\n      { "id": "checkout", "screens": [] }\n    ]\n  }\n);\n`,
    "utf8"
  );

  // Create contracts.ts file
  await writeFile(
    contractsPath,
    `// Auto-generated contracts\nexport type StartScreenId = "welcome";\n`,
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
    `import { defineClientFlowManifest } from "teleforge/web";\n\nexport const flowManifest = defineClientFlowManifest(\n  {\n    "flows": [\n      { "id": "start", "screens": [] }\n    ]\n  }\n);\n`,
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
    `import { defineClientFlowManifest } from "teleforge/web";\n\nexport const flowManifest = defineClientFlowManifest(\n  {\n    "flows": [\n      { "id": "start", "screens": [] },\n      { "id": "old-flow", "screens": [] }\n    ]\n  }\n);\n`,
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

test("checkClientManifestDrift treats malformed flows entries as unreadable", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-drift-"));
  const manifestPath = path.join(tmpDir, "client-flow-manifest.ts");

  await writeFile(
    manifestPath,
    `import { defineClientFlowManifest } from "teleforge/web";

export const flowManifest = defineClientFlowManifest(
  {
    "flows": [
      { "id": "start", "screens": [] },
      { "name": "broken" }
    ]
  }
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
    `import { defineClientFlowManifest } from "teleforge/web";\n\nexport const flowManifest = defineClientFlowManifest(\n  {\n    "flows": [\n      { "id": "start", "screens": [] }\n    ]\n  }\n);\n`,
    "utf8"
  );

  const drift = await checkClientManifestDrift({
    discoveredFlows: [],
    manifestPath
  });

  assert.equal(drift.isStale, false);
});

test("checkClientManifestDrift detects missing route in manifest", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-drift-"));
  const manifestPath = path.join(tmpDir, "client-flow-manifest.ts");
  const contractsPath = path.join(tmpDir, "contracts.ts");

  await writeFile(
    manifestPath,
    `import { defineClientFlowManifest } from "teleforge/web";\n\nexport const flowManifest = defineClientFlowManifest(\n  {\n    "flows": [\n      { "id": "start", "screens": [], "miniApp": { "routes": { "/old": "old-screen" } } }\n    ]\n  }\n);\n`,
    "utf8"
  );
  
  await writeFile(contractsPath, "// contracts\n", "utf8");

  const drift = await checkClientManifestDrift({
    discoveredFlows: [{ id: "start", routes: ["/new", "/old"] }],
    manifestPath
  });

  assert.equal(drift.isStale, true);
  assert.ok(drift.details?.some(d => d.includes("missing from manifest")));
});

test("checkClientManifestDrift detects stale route in manifest", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-drift-"));
  const manifestPath = path.join(tmpDir, "client-flow-manifest.ts");
  const contractsPath = path.join(tmpDir, "contracts.ts");

  await writeFile(
    manifestPath,
    `import { defineClientFlowManifest } from "teleforge/web";\n\nexport const flowManifest = defineClientFlowManifest(\n  {\n    "flows": [\n      { "id": "start", "screens": [], "miniApp": { "routes": { "/old": "screen", "/stale": "screen" } } }\n    ]\n  }\n);\n`,
    "utf8"
  );
  
  await writeFile(contractsPath, "// contracts\n", "utf8");

  const drift = await checkClientManifestDrift({
    discoveredFlows: [{ id: "start", routes: ["/old"] }],
    manifestPath
  });

  assert.equal(drift.isStale, true);
  assert.ok(drift.details?.some(d => d.includes("stale route")));
});

test("checkClientManifestDrift detects missing action in manifest", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-drift-"));
  const manifestPath = path.join(tmpDir, "client-flow-manifest.ts");
  const contractsPath = path.join(tmpDir, "contracts.ts");

  await writeFile(
    manifestPath,
    `import { defineClientFlowManifest } from "teleforge/web";\n\nexport const flowManifest = defineClientFlowManifest(\n  {\n    "flows": [\n      { "id": "start", "miniApp": { "routes": { "/": "screen" } }, "screens": [{ "id": "screen", "actions": ["old-action"] }] }\n    ]\n  }\n);\n`,
    "utf8"
  );
  
  await writeFile(contractsPath, "// contracts\n", "utf8");

  const drift = await checkClientManifestDrift({
    discoveredFlows: [{ id: "start", routes: ["/"], actions: [{ id: "new-action" }, { id: "old-action" }] }],
    manifestPath
  });

  assert.equal(drift.isStale, true);
  assert.ok(drift.details?.some(d => d.includes("missing from manifest")));
});

test("checkClientManifestDrift detects stale action in manifest", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-drift-"));
  const manifestPath = path.join(tmpDir, "client-flow-manifest.ts");
  const contractsPath = path.join(tmpDir, "contracts.ts");

  await writeFile(
    manifestPath,
    `import { defineClientFlowManifest } from "teleforge/web";\n\nexport const flowManifest = defineClientFlowManifest(\n  {\n    "flows": [\n      { "id": "start", "miniApp": { "routes": { "/": "screen" } }, "screens": [{ "id": "screen", "actions": ["old-action", "stale-action"] }] }\n    ]\n  }\n);\n`,
    "utf8"
  );
  
  await writeFile(contractsPath, "// contracts\n", "utf8");

  const drift = await checkClientManifestDrift({
    discoveredFlows: [{ id: "start", routes: ["/"], actions: [{ id: "old-action" }] }],
    manifestPath
  });

  assert.equal(drift.isStale, true);
  assert.ok(drift.details?.some(d => d.includes("stale action")));
});

test("checkClientManifestDrift detects missing contracts.ts file", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-drift-"));
  const manifestPath = path.join(tmpDir, "client-flow-manifest.ts");

  await writeFile(
    manifestPath,
    `import { defineClientFlowManifest } from "teleforge/web";\n\nexport const flowManifest = defineClientFlowManifest(\n  {\n    "flows": [\n      { "id": "start", "screens": [] }\n    ]\n  }\n);\n`,
    "utf8"
  );

  const drift = await checkClientManifestDrift({
    discoveredFlows: [{ id: "start" }],
    manifestPath
  });

  assert.equal(drift.isStale, true);
  assert.match(drift.reason ?? "", /contracts\.ts.*missing/);
});

test("checkClientManifestDrift ignores actions for chat-only flows", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-drift-"));
  const manifestPath = path.join(tmpDir, "client-flow-manifest.ts");
  const contractsPath = path.join(tmpDir, "contracts.ts");

  await writeFile(
    manifestPath,
    `import { defineClientFlowManifest } from "teleforge/web";\n\nexport const flowManifest = defineClientFlowManifest(\n  {\n    "flows": [\n      { "id": "chat-flow", "screens": [] }\n    ]\n  }\n);\n`,
    "utf8"
  );
  
  await writeFile(contractsPath, "// contracts\n", "utf8");

  // Chat-only flow with actions but no routes
  const drift = await checkClientManifestDrift({
    discoveredFlows: [{ id: "chat-flow", routes: [], actions: [{ id: "chat-action" }] }],
    manifestPath
  });

  // Should pass because no Mini App routes = no action comparison
  assert.equal(drift.isStale, false);
});
