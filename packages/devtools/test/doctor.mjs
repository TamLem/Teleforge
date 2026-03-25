import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import selfsigned from "selfsigned";
import { runDoctorChecks } from "../dist/utils/doctor/checks.js";

const execFileAsync = promisify(execFile);
const packageRoot = process.cwd();
const cliPath = path.join(packageRoot, "dist", "cli.js");

test("doctor checks report pass/warn/error data for a configured project", async () => {
  const projectDir = await createDoctorFixture();
  const result = await runDoctorChecks({
    cwd: projectDir,
    execFileImpl: async () => ({
      stderr: "",
      stdout: "git version 2.43.0\n"
    }),
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      statusText: "OK"
    }),
    fix: false,
    nodeVersion: "v20.11.0",
    userAgent: "pnpm/10.15.0 npm/? node/v20.11.0 linux x64"
  });

  const names = new Map(result.checks.map((check) => [check.name, check]));
  assert.equal(names.get("node_version")?.status, "pass");
  assert.equal(names.get("package_manager")?.status, "pass");
  assert.equal(names.get("git_available")?.status, "pass");
  assert.equal(names.get("teleforge_dependencies")?.status, "pass");
  assert.equal(names.get("manifest_consistency")?.status, "pass");
  assert.equal(names.get("bot_token")?.status, "pass");
  assert.equal(names.get("webhook_secret")?.status, "pass");
  assert.equal(names.get("mini_app_url")?.status, "pass");
  assert.equal(names.get("https_availability")?.status, "pass");
  assert.equal(names.get("webhook_reachable")?.status, "pass");
  assert.equal(names.get("botfather")?.status, "pass");
  assert.equal(result.status, "pass");
});

test("doctor --fix creates .env and formats the manifest", async () => {
  const projectDir = await createDoctorFixture({
    envFile: false,
    minifiedManifest: true
  });

  const result = await runDoctorChecks({
    cwd: projectDir,
    execFileImpl: async () => ({
      stderr: "",
      stdout: "git version 2.43.0\n"
    }),
    fetchImpl: async () => {
      throw new Error("connect ECONNREFUSED");
    },
    fix: true,
    nodeVersion: "v20.11.0",
    userAgent: "pnpm/10.15.0 npm/? node/v20.11.0 linux x64"
  });

  const env = await readFile(path.join(projectDir, ".env"), "utf8");
  const manifest = await readFile(path.join(projectDir, "teleforge.app.json"), "utf8");

  assert.match(env, /BOT_TOKEN=your_bot_token_here/);
  assert.match(manifest, /\n {2}"id": "doctor-fixture"/);
  assert.ok(result.fixes.some((fix) => fix.name === "create_env_file" && fix.applied));
  assert.ok(result.fixes.some((fix) => fix.name === "format_manifest" && fix.applied));
});

test("doctor --json emits machine-readable diagnostics and exits non-zero on errors", async () => {
  const projectDir = await createDoctorFixture({
    envFile: false
  });

  await assert.rejects(
    execFileAsync("node", [cliPath, "doctor", "--json"], {
      cwd: projectDir
    }),
    (error) => {
      const payload = JSON.parse(error.stdout);
      assert.equal(payload.status, "error");
      assert.ok(payload.checks.some((check) => check.name === "bot_token"));
      return true;
    }
  );
});

test("doctor reports conflicting Teleforge dependency majors", async () => {
  const projectDir = await createDoctorFixture({
    dependencyVersions: {
      "@teleforge/bot": "^1.0.0",
      "@teleforge/core": "^1.0.0",
      "@teleforge/web": "^2.0.0"
    }
  });

  const result = await runDoctorChecks({
    cwd: projectDir,
    execFileImpl: async () => ({
      stderr: "",
      stdout: "git version 2.43.0\n"
    }),
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      statusText: "OK"
    }),
    fix: false,
    nodeVersion: "v20.11.0",
    userAgent: "pnpm/10.15.0 npm/? node/v20.11.0 linux x64"
  });

  const names = new Map(result.checks.map((check) => [check.name, check]));
  assert.equal(names.get("teleforge_dependencies")?.status, "error");
});

test("doctor fails the node-version check below Node 18", async () => {
  const projectDir = await createDoctorFixture();

  const result = await runDoctorChecks({
    cwd: projectDir,
    execFileImpl: async () => ({
      stderr: "",
      stdout: "git version 2.43.0\n"
    }),
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      statusText: "OK"
    }),
    fix: false,
    nodeVersion: "v16.20.0",
    userAgent: "pnpm/10.15.0 npm/? node/v16.20.0 linux x64"
  });

  const names = new Map(result.checks.map((check) => [check.name, check]));
  assert.equal(names.get("node_version")?.status, "error");
});

async function createDoctorFixture(options = {}) {
  const envFile = options.envFile ?? true;
  const dependencyVersions = options.dependencyVersions ?? {
    "@teleforge/bot": "^1.0.0",
    "@teleforge/core": "^1.0.0",
    "@teleforge/devtools": "^1.0.0",
    "@teleforge/web": "^1.0.0"
  };
  const minifiedManifest = options.minifiedManifest ?? false;
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-doctor-"));
  const manifest = {
    $schema: "https://teleforge.dev/schemas/app-manifest.json",
    id: "doctor-fixture",
    name: "Doctor Fixture",
    version: "1.0.0",
    runtime: {
      mode: "spa",
      webFramework: "vite"
    },
    bot: {
      username: "doctor_fixture_bot",
      tokenEnv: "BOT_TOKEN",
      webhook: {
        path: "/api/webhook",
        secretEnv: "WEBHOOK_SECRET"
      }
    },
    miniApp: {
      capabilities: ["read_access"],
      entryPoint: "apps/web/src/main.tsx",
      launchModes: ["inline"],
      defaultMode: "inline"
    },
    routes: [
      {
        path: "/",
        component: "pages/Home"
      }
    ]
  };
  const certificates = selfsigned.generate([{ name: "commonName", value: "localhost" }], {
    algorithm: "sha256",
    days: 30,
    keySize: 2048,
    extensions: [
      {
        altNames: [
          { type: 2, value: "localhost" },
          { ip: "127.0.0.1", type: 7 }
        ],
        name: "subjectAltName"
      }
    ]
  });

  await mkdir(path.join(tempRoot, "apps", "web", "src", "pages"), { recursive: true });
  await mkdir(path.join(tempRoot, ".teleforge", "certs"), { recursive: true });
  await writeFile(path.join(tempRoot, "apps", "web", "src", "main.tsx"), "export {};\n", "utf8");
  await writeFile(
    path.join(tempRoot, "apps", "web", "src", "pages", "Home.tsx"),
    "export {};\n",
    "utf8"
  );
  await writeFile(
    path.join(tempRoot, ".env.example"),
    "BOT_TOKEN=your_bot_token_here\nWEBHOOK_SECRET=your_webhook_secret_here\n",
    "utf8"
  );
  await writeFile(
    path.join(tempRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "doctor-fixture",
        packageManager: "pnpm@10.15.0",
        private: true,
        dependencies: dependencyVersions
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await writeFile(path.join(tempRoot, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n", "utf8");
  await writeFile(
    path.join(tempRoot, "teleforge.app.json"),
    minifiedManifest ? JSON.stringify(manifest) : `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(tempRoot, ".teleforge", "certs", "localhost-cert.pem"),
    certificates.cert,
    "utf8"
  );
  await writeFile(
    path.join(tempRoot, ".teleforge", "certs", "localhost-key.pem"),
    certificates.private,
    "utf8"
  );

  if (envFile) {
    await writeFile(
      path.join(tempRoot, ".env"),
      "BOT_TOKEN=123:real-token\nWEBHOOK_SECRET=real-secret\nTELEFORGE_PUBLIC_URL=https://public.example.test\nTELEFORGE_DEV_HTTPS=false\n",
      "utf8"
    );
  }

  return tempRoot;
}
