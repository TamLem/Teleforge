import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  ManifestValidationError,
  loadManifest,
  loadManifestFromFile,
  validateManifest
} from "../dist/index.js";

const fixtureDir = path.join(process.cwd(), "test", "fixtures");

test("validates a current-shape manifest fixture", async () => {
  const raw = await readFixture("valid-manifest.json");
  const result = validateManifest(JSON.parse(raw));

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.id, "sample-app");
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
    assert.ok(result.errors.some((issue) => issue.path.join(".") === "name"));
  }
});

test("loads and validates an explicit manifest file", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-core-"));
  const raw = await readFixture("valid-manifest.json");
  const manifestPath = path.join(tempRoot, "derived-manifest.json");
  await writeFile(manifestPath, raw, "utf8");

  const result = await loadManifestFromFile(manifestPath);

  assert.equal(result.name, "Sample App");
});

test("throws ManifestValidationError for invalid explicit manifest files", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-core-"));
  const raw = await readFixture("invalid-manifest.json");
  const manifestPath = path.join(tempRoot, "derived-manifest.json");
  await writeFile(manifestPath, raw, "utf8");

  await assert.rejects(loadManifestFromFile(manifestPath), (error) => {
    assert.ok(error instanceof ManifestValidationError);
    return true;
  });
});

test("rejects default file-based manifest loading", async () => {
  await assert.rejects(loadManifest(process.cwd()), /teleforge\.config\.ts/);
});

async function readFixture(fileName) {
  return readFile(path.join(fixtureDir, fileName), "utf8");
}
