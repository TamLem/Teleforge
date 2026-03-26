import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, "dist", "cli.js");

test("generates SPA scaffold", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-spa-"));
  const projectName = "sample-spa";

  await execFileAsync("node", [cliPath, projectName, "--mode", "spa", "--yes"], {
    cwd: tmpRoot
  });

  const manifestPath = path.join(tmpRoot, projectName, "teleforge.app.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.runtime.mode, "spa");
  assert.equal(manifest.runtime.webFramework, "vite");
  assert.equal(manifest.routes[1].path, "/settings");

  const webPackagePath = path.join(tmpRoot, projectName, "apps", "web", "package.json");
  const webPackage = JSON.parse(await readFile(webPackagePath, "utf8"));
  assert.equal(webPackage.scripts.dev, "vite");

  const rootPackagePath = path.join(tmpRoot, projectName, "package.json");
  const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));
  assert.equal(
    rootPackage.scripts.test,
    "node --import tsx --test apps/bot/test/**/*.test.ts apps/web/test/**/*.test.tsx"
  );

  const botTestPath = path.join(tmpRoot, projectName, "apps", "bot", "test", "start.test.ts");
  const botTest = await readFile(botTestPath, "utf8");
  assert.match(botTest, /replyWithWebApp/);

  const webTestPath = path.join(tmpRoot, projectName, "apps", "web", "test", "home.test.tsx");
  const webTest = await readFile(webTestPath, "utf8");
  assert.match(webTest, /renderToStaticMarkup/);
});

test("generates BFF scaffold", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-bff-"));
  const projectName = "sample-bff";

  await execFileAsync("node", [cliPath, projectName, "--mode", "bff", "--yes"], {
    cwd: tmpRoot
  });

  const manifestPath = path.join(tmpRoot, projectName, "teleforge.app.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.runtime.mode, "bff");
  assert.equal(manifest.runtime.webFramework, "nextjs");
  assert.equal(manifest.runtime.apiRoutes, "apps/api/src/routes");

  const nextPagePath = path.join(
    tmpRoot,
    projectName,
    "apps",
    "web",
    "app",
    "settings",
    "page.tsx"
  );
  const nextPage = await readFile(nextPagePath, "utf8");
  assert.match(nextPage, /SettingsPage/);
  assert.match(nextPage, /\.\.\/\.\.\/src\/pages\/Settings/);

  const nextConfigPath = path.join(tmpRoot, projectName, "apps", "web", "next.config.mjs");
  const nextConfig = await readFile(nextConfigPath, "utf8");
  assert.match(nextConfig, /nextConfig/);

  const rootPackagePath = path.join(tmpRoot, projectName, "package.json");
  const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));
  assert.equal(rootPackage.devDependencies.tsx, "^4.19.2");
  assert.equal(rootPackage.devDependencies["@teleforge/devtools"], "^1.0.0");
  assert.equal(
    rootPackage.scripts.test,
    "node --import tsx --test apps/bot/test/**/*.test.ts apps/web/test/**/*.test.tsx"
  );

  const botTestPath = path.join(tmpRoot, projectName, "apps", "bot", "test", "start.test.ts");
  const botTest = await readFile(botTestPath, "utf8");
  assert.match(botTest, /Open Sample Bff/);

  const webTestPath = path.join(tmpRoot, projectName, "apps", "web", "test", "home.test.tsx");
  const webTest = await readFile(webTestPath, "utf8");
  assert.match(webTest, /Welcome to Sample Bff/);
});
