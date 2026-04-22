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

test("generates the unified Teleforge scaffold", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-app-"));
  const projectName = "sample-app";

  await execFileAsync("node", [cliPath, projectName, "--yes"], {
    cwd: tmpRoot
  });

  const configPath = path.join(tmpRoot, projectName, "teleforge.config.ts");
  const configSource = await readFile(configPath, "utf8");
  assert.match(configSource, /defineTeleforgeApp/);
  assert.match(configSource, /root: "apps\/bot\/src\/flows"/);
  assert.doesNotMatch(configSource, /mode: "spa"/);
  assert.doesNotMatch(configSource, /webFramework: "vite"/);
  assert.doesNotMatch(configSource, /routes:/);

  const rootPackagePath = path.join(tmpRoot, projectName, "package.json");
  const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));
  assert.equal(rootPackage.name, "sample-app");
  assert.deepEqual(rootPackage.workspaces, ["apps/*", "packages/*"]);
  assert.equal(rootPackage.dependencies.teleforge, "^0.1.0");
  assert.equal(
    rootPackage.scripts.test,
    "node --import tsx --test apps/bot/test/**/*.test.ts apps/web/test/**/*.test.tsx"
  );

  const legacyManifestPath = path.join(tmpRoot, projectName, "teleforge.app.json");
  await assert.rejects(readFile(legacyManifestPath, "utf8"), /ENOENT/);

  const hasLegacyDeps = Object.keys(rootPackage.dependencies ?? {}).some((name) =>
    name.startsWith("@teleforgex/")
  );
  assert.equal(hasLegacyDeps, false);

  const webPackagePath = path.join(tmpRoot, projectName, "apps", "web", "package.json");
  const webPackage = JSON.parse(await readFile(webPackagePath, "utf8"));
  assert.equal(webPackage.name, "@sample-app/web");
  assert.equal(webPackage.dependencies["@sample-app/types"], "workspace:*");
  assert.equal(webPackage.scripts.dev, "vite");

  const botPackagePath = path.join(tmpRoot, projectName, "apps", "bot", "package.json");
  const botPackage = JSON.parse(await readFile(botPackagePath, "utf8"));
  assert.equal(botPackage.name, "@sample-app/bot");
  assert.equal(botPackage.dependencies["@sample-app/types"], "workspace:*");

  const apiPackagePath = path.join(tmpRoot, projectName, "apps", "api", "package.json");
  const apiPackage = JSON.parse(await readFile(apiPackagePath, "utf8"));
  assert.equal(apiPackage.name, "@sample-app/api");
  assert.equal(apiPackage.dependencies["@sample-app/types"], "workspace:*");

  const typesPackagePath = path.join(tmpRoot, projectName, "packages", "types", "package.json");
  const typesPackage = JSON.parse(await readFile(typesPackagePath, "utf8"));
  assert.equal(typesPackage.name, "@sample-app/types");
  assert.equal(typesPackage.exports["."], "./src/index.ts");

  const typesSourcePath = path.join(tmpRoot, projectName, "packages", "types", "src", "index.ts");
  const typesSource = await readFile(typesSourcePath, "utf8");
  assert.match(typesSource, /interface StartFlowState/);

  const startFlowPath = path.join(
    tmpRoot,
    projectName,
    "apps",
    "bot",
    "src",
    "flows",
    "start.flow.ts"
  );
  const startFlow = await readFile(startFlowPath, "utf8");
  assert.match(startFlow, /import type \{ StartFlowState \} from "@sample-app\/types"/);
  assert.match(startFlow, /import \{ defineFlow \} from "teleforge\/web"/);
  assert.match(startFlow, /defineFlow<StartFlowState>/);
  assert.match(startFlow, /command: "start"/);
  assert.doesNotMatch(startFlow, /component:/);
  assert.match(startFlow, /screen: "home"/);
  assert.match(startFlow, /route: "\/"/);

  const runtimePath = path.join(tmpRoot, projectName, "apps", "bot", "src", "runtime.ts");
  const runtimeSource = await readFile(runtimePath, "utf8");
  assert.match(runtimeSource, /createDiscoveredBotRuntime/);

  const botTestPath = path.join(tmpRoot, projectName, "apps", "bot", "test", "start.test.ts");
  const botTest = await readFile(botTestPath, "utf8");
  assert.match(botTest, /startFlow/);
  assert.match(botTest, /bot entry command/);

  const appPath = path.join(tmpRoot, projectName, "apps", "web", "src", "App.tsx");
  const appSource = await readFile(appPath, "utf8");
  assert.match(appSource, /framework-owned Mini App runtime/);
  assert.match(appSource, /Screen: home/);

  const mainPath = path.join(tmpRoot, projectName, "apps", "web", "src", "main.tsx");
  const mainSource = await readFile(mainPath, "utf8");
  assert.match(mainSource, /TeleforgeMiniApp/);
  assert.match(mainSource, /startFlow/);
  assert.match(mainSource, /homeScreen/);

  const screenPath = path.join(
    tmpRoot,
    projectName,
    "apps",
    "web",
    "src",
    "screens",
    "home.screen.tsx"
  );
  const screenSource = await readFile(screenPath, "utf8");
  assert.match(screenSource, /import type \{ StartFlowState \} from "@sample-app\/types"/);
  assert.match(screenSource, /defineScreen/);
  assert.match(screenSource, /defineScreen<StartFlowState>/);
  assert.match(screenSource, /id: "home"/);

  const webTestPath = path.join(tmpRoot, projectName, "apps", "web", "test", "home.test.tsx");
  const webTest = await readFile(webTestPath, "utf8");
  assert.match(webTest, /renderToStaticMarkup/);
  assert.match(webTest, /Screen: home/);

  const readmePath = path.join(tmpRoot, projectName, "README.md");
  const readme = await readFile(readmePath, "utf8");
  assert.match(readme, /apps\/web.*Mini App shell, screens, and styles/);
  assert.match(readme, /apps\/web\/src\/screens\/home\.screen\.tsx/);
  assert.doesNotMatch(readme, /Next\.js BFF web/);
  assert.doesNotMatch(readme, /settings/i);
});

test("generates scaffold with --link flag using link: protocol", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-link-"));
  const projectName = "linked-app";

  await execFileAsync("node", [cliPath, projectName, "--yes", "--link", "/home/aj/hustle/tmf"], {
    cwd: tmpRoot
  });

  const rootPackagePath = path.join(tmpRoot, projectName, "package.json");
  const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));

  assert.equal(rootPackage.dependencies.teleforge, "link:/home/aj/hustle/tmf/packages/teleforge");
});

test("rejects project names that normalize to empty app metadata", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-invalid-name-"));

  await assert.rejects(
    () =>
      execFileAsync("node", [cliPath, "!!!", "--yes"], {
        cwd: tmpRoot
      }),
    /must contain at least one letter or number/
  );
});
