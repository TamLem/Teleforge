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
  assert.doesNotMatch(configSource, /webhook:/);
  assert.doesNotMatch(configSource, /WEBHOOK_SECRET/);
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
  assert.ok(rootPackage.scripts.lint);
  assert.ok(rootPackage.scripts.typecheck);
  assert.ok(rootPackage.scripts.build);
  assert.ok(rootPackage.scripts.check);

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
  assert.ok(webPackage.scripts.typecheck);

  const botPackagePath = path.join(tmpRoot, projectName, "apps", "bot", "package.json");
  const botPackage = JSON.parse(await readFile(botPackagePath, "utf8"));
  assert.equal(botPackage.name, "@sample-app/bot");
  assert.equal(botPackage.dependencies["@sample-app/types"], "workspace:*");
  assert.ok(botPackage.scripts.typecheck);

  const apiPackagePath = path.join(tmpRoot, projectName, "apps", "api", "package.json");
  await assert.rejects(readFile(apiPackagePath, "utf8"), /ENOENT/);

  const envExamplePath = path.join(tmpRoot, projectName, ".env.example");
  const envExample = await readFile(envExamplePath, "utf8");
  assert.match(envExample, /BOT_TOKEN=your_bot_token_here/);
  assert.doesNotMatch(envExample, /WEBHOOK_SECRET/);

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
  assert.match(runtimeSource, /startTeleforgeBot/);
  assert.match(runtimeSource, /createDevBotRuntime/);

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
  assert.match(mainSource, /flowManifest/);
  assert.match(mainSource, /flowManifest=\{flowManifest\}/);
  assert.doesNotMatch(mainSource, /bot\/src\/flows/);
  assert.match(mainSource, /homeScreen/);
  assert.match(mainSource, /teleforge-generated\/client-flow-manifest/);

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
  assert.doesNotMatch(readme, /apps\/api.*placeholders/);
  assert.match(readme, /apps\/api.*not part of the default scaffold/);
  assert.match(readme, /create-teleforge-app my-app --with-api/);
  assert.match(readme, /apps\/web\/src\/teleforge-generated\/client-flow-manifest\.ts/);
  assert.match(readme, /teleforge generate client-manifest/);
  assert.match(readme, /apps\/web\/src\/screens\/home\.screen\.tsx/);
  assert.doesNotMatch(readme, /Next\.js BFF web/);
  assert.doesNotMatch(readme, /settings/i);
});

test("generates optional API placeholders with --with-api", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-api-app-"));
  const projectName = "api-app";

  await execFileAsync("node", [cliPath, projectName, "--yes", "--with-api"], {
    cwd: tmpRoot
  });

  const configPath = path.join(tmpRoot, projectName, "teleforge.config.ts");
  const configSource = await readFile(configPath, "utf8");
  assert.match(configSource, /webhook:/);
  assert.match(configSource, /path: "\/api\/webhook"/);
  assert.match(configSource, /secretEnv: "WEBHOOK_SECRET"/);

  const envExamplePath = path.join(tmpRoot, projectName, ".env.example");
  const envExample = await readFile(envExamplePath, "utf8");
  assert.match(envExample, /WEBHOOK_SECRET=your_webhook_secret_here/);

  const apiPackagePath = path.join(tmpRoot, projectName, "apps", "api", "package.json");
  const apiPackage = JSON.parse(await readFile(apiPackagePath, "utf8"));
  assert.equal(apiPackage.name, "@api-app/api");
  assert.equal(apiPackage.dependencies["@api-app/types"], "workspace:*");
  assert.ok(apiPackage.scripts.typecheck);

  const flowHookPath = path.join(
    tmpRoot,
    projectName,
    "apps",
    "api",
    "src",
    "flow-hooks",
    "start",
    "home.ts"
  );
  const flowHookSource = await readFile(flowHookPath, "utf8");
  assert.match(flowHookSource, /guard/);
  assert.match(flowHookSource, /loader/);
  assert.match(flowHookSource, /onSubmit/);

  const healthRoutePath = path.join(
    tmpRoot,
    projectName,
    "apps",
    "api",
    "src",
    "routes",
    "health.ts"
  );
  const healthRouteSource = await readFile(healthRoutePath, "utf8");
  assert.match(healthRouteSource, /\/api\/health/);

  const webhookRoutePath = path.join(
    tmpRoot,
    projectName,
    "apps",
    "api",
    "src",
    "routes",
    "webhook.ts"
  );
  const webhookRouteSource = await readFile(webhookRoutePath, "utf8");
  assert.match(webhookRouteSource, /\/api\/webhook/);

  const readmePath = path.join(tmpRoot, projectName, "README.md");
  const readme = await readFile(readmePath, "utf8");
  assert.match(readme, /apps\/api.*optional server-hook and webhook placeholders/);
  assert.match(readme, /generated with `--with-api`/);
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

  try {
    await execFileAsync("node", [cliPath, "!!!", "--yes"], {
      cwd: tmpRoot
    });
    assert.fail("Expected CLI to exit non-zero for invalid project name");
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    assert.equal(code, 1);
  }
});
