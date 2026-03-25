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
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      statusText: "OK"
    }),
    fix: false
  });

  const names = new Map(result.checks.map((check) => [check.name, check]));
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
    fetchImpl: async () => {
      throw new Error("connect ECONNREFUSED");
    },
    fix: true
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

async function createDoctorFixture(options = {}) {
  const envFile = options.envFile ?? true;
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
