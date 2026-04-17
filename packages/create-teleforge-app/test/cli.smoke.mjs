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

  const configPath = path.join(tmpRoot, projectName, "teleforge.config.ts");
  const configSource = await readFile(configPath, "utf8");
  assert.match(configSource, /defineTeleforgeApp/);
  assert.match(configSource, /mode": "spa"/);
  assert.match(configSource, /webFramework": "vite"/);
  assert.match(configSource, /path: "\/settings"/);

  const webPackagePath = path.join(tmpRoot, projectName, "apps", "web", "package.json");
  const webPackage = JSON.parse(await readFile(webPackagePath, "utf8"));
  assert.equal(webPackage.scripts.dev, "vite");

  const rootPackagePath = path.join(tmpRoot, projectName, "package.json");
  const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));
  assert.equal(rootPackage.dependencies.teleforge, "^0.1.0");
  assert.equal(
    rootPackage.scripts.test,
    "node --import tsx --test apps/bot/test/**/*.test.ts apps/web/test/**/*.test.tsx"
  );

  const botTestPath = path.join(tmpRoot, projectName, "apps", "bot", "test", "start.test.ts");
  const botTest = await readFile(botTestPath, "utf8");
  assert.match(botTest, /replyWithWebApp/);

  const webTestPath = path.join(tmpRoot, projectName, "apps", "web", "test", "home.test.tsx");
  const webTest = await readFile(webTestPath, "utf8");
  assert.match(webTest, /import React from "react"/);
  assert.match(webTest, /renderToStaticMarkup/);

  const homePagePath = path.join(tmpRoot, projectName, "apps", "web", "src", "pages", "Home.tsx");
  const homePage = await readFile(homePagePath, "utf8");
  assert.match(homePage, /import React from "react"/);
  assert.match(homePage, /requireLaunchMode\(\["inline", "compact", "fullscreen"\]\)/);
  assert.match(homePage, /inline, compact, and fullscreen launch modes/);

  const settingsPagePath = path.join(
    tmpRoot,
    projectName,
    "apps",
    "web",
    "src",
    "pages",
    "Settings.tsx"
  );
  const settingsPage = await readFile(settingsPagePath, "utf8");
  assert.match(settingsPage, /import React from "react"/);

  const appPath = path.join(tmpRoot, projectName, "apps", "web", "src", "App.tsx");
  const appSource = await readFile(appPath, "utf8");
  assert.match(appSource, /import React, \{ useEffect, useState \} from "react"/);

  const guardPath = path.join(
    tmpRoot,
    projectName,
    "apps",
    "web",
    "src",
    "guards",
    "launchMode.ts"
  );
  const guard = await readFile(guardPath, "utf8");
  assert.match(guard, /typeof window === "undefined"/);
  assert.match(guard, /if \(mode === "unknown"\) return null/);
});

test("generates BFF scaffold", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-bff-"));
  const projectName = "sample-bff";

  await execFileAsync("node", [cliPath, projectName, "--mode", "bff", "--yes"], {
    cwd: tmpRoot
  });

  const configPath = path.join(tmpRoot, projectName, "teleforge.config.ts");
  const configSource = await readFile(configPath, "utf8");
  assert.match(configSource, /mode": "bff"/);
  assert.match(configSource, /webFramework": "nextjs"/);
  assert.match(configSource, /apiRoutes": "apps\/api\/src\/routes"/);

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
  assert.equal(rootPackage.dependencies.teleforge, "^0.1.0");
  assert.equal(
    rootPackage.scripts.test,
    "node --import tsx --test apps/bot/test/**/*.test.ts apps/web/test/**/*.test.tsx"
  );

  const botTestPath = path.join(tmpRoot, projectName, "apps", "bot", "test", "start.test.ts");
  const botTest = await readFile(botTestPath, "utf8");
  assert.match(botTest, /Open Sample Bff/);

  const webTestPath = path.join(tmpRoot, projectName, "apps", "web", "test", "home.test.tsx");
  const webTest = await readFile(webTestPath, "utf8");
  assert.match(webTest, /import React from "react"/);
  assert.match(webTest, /Welcome to Sample Bff/);

  const homePagePath = path.join(tmpRoot, projectName, "apps", "web", "src", "pages", "Home.tsx");
  const homePage = await readFile(homePagePath, "utf8");
  assert.match(homePage, /requireLaunchMode\(\["inline", "compact", "fullscreen"\]\)/);
});

test("generates scaffold with --link flag using link: protocol", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-link-"));
  const projectName = "linked-app";

  await execFileAsync(
    "node",
    [cliPath, projectName, "--mode", "spa", "--yes", "--link", "/home/aj/hustle/tmf"],
    { cwd: tmpRoot }
  );

  const rootPackagePath = path.join(tmpRoot, projectName, "package.json");
  const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));

  assert.equal(
    rootPackage.dependencies.teleforge,
    "link:/home/aj/hustle/tmf/packages/teleforge"
  );
});

test("rejects project names that normalize to empty app metadata", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-invalid-name-"));

  await assert.rejects(
    () =>
      execFileAsync("node", [cliPath, "!!!", "--mode", "spa", "--yes"], {
        cwd: tmpRoot
      }),
    /must contain at least one letter or number/
  );
});
