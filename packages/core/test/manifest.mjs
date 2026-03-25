import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ManifestValidationError, loadManifest, validateManifest } from "../dist/index.js";

const fixtureDir = path.join(process.cwd(), "test", "fixtures");

test("validates a current-shape manifest fixture", async () => {
  const raw = await readFixture("valid-manifest.json");
  const result = validateManifest(JSON.parse(raw));

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.id, "sample-app");
    assert.equal(result.data.runtime.webFramework, "vite");
    assert.equal(result.data.routes[0]?.component, "pages/Home");
  }
});

test("rejects an invalid manifest with clear issues", async () => {
  const raw = await readFixture("invalid-manifest.json");
  const result = validateManifest(JSON.parse(raw));

  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.errors.some((issue) => issue.path.join(".") === "id"));
    assert.ok(result.errors.some((issue) => issue.path.join(".") === "version"));
    assert.ok(result.errors.some((issue) => issue.path.join(".") === "runtime.webFramework"));
  }
});

test("loads and validates a manifest file from a project directory", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-core-"));
  const raw = await readFixture("valid-manifest.json");
  await writeFile(path.join(tempRoot, "teleforge.app.json"), raw, "utf8");

  const result = await loadManifest(tempRoot);

  assert.equal(result.manifest.name, "Sample App");
  assert.equal(result.manifestPath, path.join(tempRoot, "teleforge.app.json"));
});

test("throws ManifestValidationError for invalid manifest files", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-core-"));
  const raw = await readFixture("invalid-manifest.json");
  await writeFile(path.join(tempRoot, "teleforge.app.json"), raw, "utf8");

  await assert.rejects(loadManifest(tempRoot), (error) => {
    assert.ok(error instanceof ManifestValidationError);
    assert.match(error.message, /runtime\.webFramework|runtime.webFramework/);
    return true;
  });
});

async function readFixture(fileName) {
  return readFile(path.join(fixtureDir, fileName), "utf8");
}
