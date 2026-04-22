import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const forbiddenTerms = [
  { term: "teleforge.app.json", message: "Use teleforge.config.ts as the default config path" },
  { term: "@teleforgex/", message: "Use the unified teleforge package for public app code" },
  { term: "BFF mode", message: "BFF is not a public product mode" },
  { term: "SPA mode", message: "SPA is not a user-facing framework choice" },
  { term: "Next.js mode", message: "Next.js is not a user-facing framework choice" }
];

// Files that are explicitly allowed to mention legacy terms because they are
// migration guides, internal task docs, or historical references.
const whitelist = new Set([
  "documentation-cutover-task.md",
  "flow-first-execution-plan.md",
  "flow-first-migration.md",
  "framework-cleanup-task.md",
  "pickup-tg-migration-plan.md",
  "scaffoling_update.md"
]);

const exampleWhitelist = new Set([]);

async function collectMarkdownFiles(directory, relativePrefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativePrefix, entry.name);
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(absolutePath, relativePath)));
      continue;
    }

    if (entry.name.endsWith(".md")) {
      files.push({ absolutePath, relativePath });
    }
  }

  return files;
}

function findViolations(source, relativePath) {
  const violations = [];

  for (const { term, message } of forbiddenTerms) {
    if (source.includes(term)) {
      violations.push({ message, relativePath, term });
    }
  }

  return violations;
}

test("public docs do not contain forbidden legacy phrasing", async () => {
  const docsDir = path.join(rootDir, "docs");
  const files = await collectMarkdownFiles(docsDir);
  const allViolations = [];

  for (const { absolutePath, relativePath } of files) {
    if (whitelist.has(relativePath)) {
      continue;
    }

    const source = await readFile(absolutePath, "utf8");
    const violations = findViolations(source, relativePath);
    allViolations.push(...violations);
  }

  if (allViolations.length > 0) {
    const summary = allViolations
      .map((v) => `  - ${v.relativePath}: "${v.term}" — ${v.message}`)
      .join("\n");
    assert.fail(`Forbidden legacy phrasing found in public docs:\n${summary}`);
  }
});

test("example app docs do not contain forbidden legacy phrasing", async () => {
  const exampleDirs = [
    path.join(rootDir, "examples", "starter-app"),
    path.join(rootDir, "apps", "task-shop")
  ];
  const allViolations = [];

  for (const baseDir of exampleDirs) {
    try {
      await stat(baseDir);
    } catch {
      continue;
    }

    const files = await collectMarkdownFiles(baseDir);
    for (const { absolutePath, relativePath } of files) {
      if (exampleWhitelist.has(relativePath)) {
        continue;
      }

      const source = await readFile(absolutePath, "utf8");
      const violations = findViolations(source, relativePath);
      allViolations.push(...violations);
    }
  }

  if (allViolations.length > 0) {
    const summary = allViolations
      .map((v) => `  - ${v.relativePath}: "${v.term}" — ${v.message}`)
      .join("\n");
    assert.fail(`Forbidden legacy phrasing found in example docs:\n${summary}`);
  }
});

test("generated scaffold does not contain forbidden legacy phrasing", async () => {
  const templatePath = path.join(
    rootDir,
    "packages",
    "create-teleforge-app",
    "src",
    "templates.ts"
  );
  const source = await readFile(templatePath, "utf8");
  const violations = findViolations(source, "packages/create-teleforge-app/src/templates.ts");

  if (violations.length > 0) {
    const summary = violations.map((v) => `  - "${v.term}" — ${v.message}`).join("\n");
    assert.fail(`Forbidden legacy phrasing found in scaffold templates:\n${summary}`);
  }
});
