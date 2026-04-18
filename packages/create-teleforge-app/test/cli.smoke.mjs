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
  assert.match(configSource, /mode: "spa"/);
  assert.match(configSource, /webFramework: "vite"/);
  assert.doesNotMatch(configSource, /routes:/);

  const rootPackagePath = path.join(tmpRoot, projectName, "package.json");
  const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));
  assert.equal(rootPackage.dependencies.teleforge, "^0.1.0");
  assert.equal(
    rootPackage.scripts.test,
    "node --import tsx --test apps/bot/test/**/*.test.ts apps/web/test/**/*.test.tsx"
  );

  const webPackagePath = path.join(tmpRoot, projectName, "apps", "web", "package.json");
  const webPackage = JSON.parse(await readFile(webPackagePath, "utf8"));
  assert.equal(webPackage.scripts.dev, "vite");

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
  assert.match(startFlow, /import \{ defineFlow \} from "teleforge\/web"/);
  assert.match(startFlow, /command: "start"/);
  assert.match(startFlow, /component: "screens\/home"/);
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
  assert.match(screenSource, /defineScreen/);
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
