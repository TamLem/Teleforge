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
    fix: false,
    nodeVersion: "v20.11.0",
    userAgent: "pnpm/10.15.0 npm/? node/v20.11.0 linux x64"
  });

  const names = new Map(result.checks.map((check) => [check.name, check]));
  assert.equal(names.get("node_version")?.status, "pass");
  assert.equal(names.get("package_manager")?.status, "pass");
  assert.equal(names.get("teleforge_dependencies")?.status, "pass");
  const manifestCheck = names.get("manifest_consistency");
  assert.equal(
    manifestCheck?.status,
    "pass",
    `manifest_consistency expected pass but was ${manifestCheck?.status}: ${manifestCheck?.message}${manifestCheck?.details ? " — " + manifestCheck.details.join("; ") : ""}`
  );
  assert.equal(names.get("bot_token")?.status, "pass");
  assert.equal(names.get("webhook_secret")?.status, "pass");
  assert.equal(names.get("mini_app_url")?.status, "pass");
  // HTTPS certs only checked when TELEFORGE_DEV_HTTPS is set
  assert.equal(names.get("https_availability")?.status, undefined);
  assert.equal(names.get("webhook_reachable")?.status, "pass");
  assert.equal(names.get("runtime_secrets")?.status, "pass");
  assert.equal(names.get("webhook_mode")?.status, "pass");
  assert.equal(result.status, "pass");
});

test("doctor accepts polling projects without webhook configuration", async () => {
  const projectDir = await createDoctorFixture({
    webhook: false
  });
  const result = await runDoctorChecks({
    cwd: projectDir,
    fetchImpl: async () => {
      throw new Error("Webhook should not be checked for polling projects.");
    },
    fix: false,
    nodeVersion: "v20.11.0",
    userAgent: "pnpm/10.15.0 npm/? node/v20.11.0 linux x64"
  });

  const names = new Map(result.checks.map((check) => [check.name, check]));
  assert.equal(names.get("manifest_consistency")?.status, "pass");
  assert.equal(names.get("webhook_secret")?.status, "pass");
  assert.equal(names.get("webhook_reachable")?.status, "pass");
  assert.equal(names.get("webhook_mode")?.status, "pass");
  assert.equal(result.status, "pass");
});

test("doctor accepts TELEFORGE_PUBLIC_URL when MINI_APP_URL is blank", async () => {
  const projectDir = await createDoctorFixture({
    blankMiniAppUrl: true,
    webhook: false
  });
  const result = await runDoctorChecks({
    cwd: projectDir,
    fetchImpl: async () => {
      throw new Error("Webhook should not be checked for polling projects.");
    },
    fix: false,
    nodeVersion: "v20.11.0",
    userAgent: "pnpm/10.15.0 npm/? node/v20.11.0 linux x64"
  });

  const names = new Map(result.checks.map((check) => [check.name, check]));
  assert.equal(names.get("mini_app_url")?.status, "pass");
  assert.equal(names.get("runtime_secrets")?.status, "pass");
  assert.equal(result.status, "pass");
});

test("doctor treats webhook placeholders as inactive for polling delivery", async () => {
  const projectDir = await createDoctorFixture({
    webhookEnv: false
  });
  const result = await runDoctorChecks({
    cwd: projectDir,
    fetchImpl: async () => {
      throw new Error("Webhook should not be checked for polling projects.");
    },
    fix: false,
    nodeVersion: "v20.11.0",
    userAgent: "pnpm/10.15.0 npm/? node/v20.11.0 linux x64"
  });

  const names = new Map(result.checks.map((check) => [check.name, check]));
  assert.equal(names.get("webhook_secret")?.status, "pass");
  assert.match(names.get("webhook_secret")?.message ?? "", /polling delivery/);
  assert.equal(names.get("webhook_reachable")?.status, "pass");
  assert.match(names.get("webhook_reachable")?.message ?? "", /polling delivery/);
  assert.equal(names.get("webhook_mode")?.status, "pass");
  assert.equal(result.status, "pass");
});

test("doctor validates webhook placeholders only when webhook delivery is enabled", async () => {
  const projectDir = await createDoctorFixture({
    delivery: "webhook",
    webhookEnv: false
  });
  const result = await runDoctorChecks({
    cwd: projectDir,
    fetchImpl: async () => {
      throw new Error("connect ECONNREFUSED");
    },
    fix: false,
    nodeVersion: "v20.11.0",
    userAgent: "pnpm/10.15.0 npm/? node/v20.11.0 linux x64"
  });

  const names = new Map(result.checks.map((check) => [check.name, check]));
  assert.equal(names.get("webhook_secret")?.status, "warn");
  assert.equal(names.get("webhook_reachable")?.status, "error");
  assert.equal(names.get("webhook_mode")?.status, "warn");
  assert.equal(result.status, "error");
});

test.skip("doctor cli --json emits machine-readable diagnostics", async () => {
  const projectDir = await createDoctorFixture({
    configName: "teleforge.config.mjs"
  });
  const { stdout } = await execFileAsync("node", [cliPath, "doctor", "--json"], {
    cwd: projectDir
  });

  assert.ok(stdout.trim().length > 0, "Expected CLI to emit JSON on stdout");
  const payload = JSON.parse(stdout);
  assert.equal(payload.status, "pass");
  assert.ok(payload.checks.some((check) => check.name === "bot_token"));
});

test("doctor --fix creates .env from .env.example", async () => {
  const projectDir = await createDoctorFixture({
    configFile: true,
    envFile: false,
    minifiedManifest: true
  });

  const result = await runDoctorChecks({
    cwd: projectDir,
    fetchImpl: async () => {
      throw new Error("connect ECONNREFUSED");
    },
    fix: true,
    nodeVersion: "v20.11.0",
    userAgent: "pnpm/10.15.0 npm/? node/v20.11.0 linux x64"
  });

  const env = await readFile(path.join(projectDir, ".env"), "utf8");

  assert.match(env, /BOT_TOKEN=your_bot_token_here/);
  assert.ok(result.fixes.some((fix) => fix.name === "create_env_file" && fix.applied));
});

test("runDoctorChecks returns machine-readable diagnostics for errors", async () => {
  const projectDir = await createDoctorFixture({
    envFile: false
  });

  const payload = await runDoctorChecks({
    cwd: projectDir,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      statusText: "OK"
    }),
    fix: false,
    nodeVersion: "v20.11.0",
    userAgent: "pnpm/10.15.0 npm/? node/v20.11.0 linux x64"
  });
  assert.equal(payload.status, "error");
  assert.ok(payload.checks.some((check) => check.name === "bot_token"));
});

test("doctor reports conflicting Teleforge dependency majors", async () => {
  const projectDir = await createDoctorFixture({
    dependencyVersions: {
      teleforge: "^0.1.0",
      "@teleforgex/web": "^2.0.0"
    }
  });

  const result = await runDoctorChecks({
    cwd: projectDir,
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

test("doctor warns when client manifest is missing but flows are discovered", async () => {
  const projectDir = await createDoctorFixture({ flowsDir: true });

  const result = await runDoctorChecks({
    cwd: projectDir,
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
  assert.equal(names.get("client_manifest_drift")?.status, "warn");
  assert.match(names.get("client_manifest_drift")?.message ?? "", /missing/);
});

test("doctor passes when client manifest is in sync with discovered flows", async () => {
  const projectDir = await createDoctorFixture({ flowsDir: true, clientManifest: true });

  const result = await runDoctorChecks({
    cwd: projectDir,
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
  assert.equal(names.get("client_manifest_drift")?.status, "pass");
});

test("doctor warns when client manifest is out of sync with discovered flows", async () => {
  const projectDir = await createDoctorFixture({
    flowsDir: true,
    clientManifest: true,
    extraFlow: true,
    staleManifest: true
  });

  const result = await runDoctorChecks({
    cwd: projectDir,
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
  assert.equal(names.get("client_manifest_drift")?.status, "warn");
  assert.match(
    names.get("client_manifest_drift")?.details?.join(" ") ?? "",
    /missing from manifest/
  );
});

async function createDoctorFixture(options = {}) {
  const configFile = options.configFile ?? true;
  const envFile = options.envFile ?? true;
  const dependencyVersions = options.dependencyVersions ?? {
    teleforge: "^0.1.0"
  };
  const minifiedManifest = options.minifiedManifest ?? false;
  const includeWebhook = options.webhook ?? true;
  const includeWebhookEnv = options.webhookEnv ?? includeWebhook;
  const delivery = options.delivery;
  const configName = options.configName ?? "teleforge.config.ts";
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-doctor-"));
  const manifest = {
    $schema: "https://teleforge.dev/schemas/app-manifest.json",
    id: "doctor-fixture",
    name: "Doctor Fixture",
    version: "1.0.0",
    runtime: delivery ? { bot: { delivery } } : {},
    bot: {
      username: "doctor_fixture_bot",
      tokenEnv: "BOT_TOKEN",
      ...(includeWebhook
        ? {
            webhook: {
              path: "/api/webhook",
              secretEnv: "WEBHOOK_SECRET"
            }
          }
        : {})
    },
    miniApp: {
      capabilities: ["read_access"],
      entryPoint: "apps/web/src/main.tsx",
      launchModes: ["inline"],
      defaultMode: "inline"
    },
    // Only include explicit routes when NOT using flows
    // When flows are enabled, routes are derived from flow miniApp.routes
    ...(options.flowsDir || options.extraFlow
      ? {}
      : {
          routes: [
            {
              path: "/",
              component: "pages/Home"
            }
          ]
        })
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
    includeWebhookEnv
      ? "BOT_TOKEN=your_bot_token_here\nWEBHOOK_SECRET=your_webhook_secret_here\n"
      : "BOT_TOKEN=your_bot_token_here\n",
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
  if (configFile) {
    const configSource = `export default ${JSON.stringify(
      {
        app: {
          id: manifest.id,
          name: manifest.name,
          version: manifest.version
        },
        runtime: manifest.runtime,
        bot: manifest.bot,
        ...(options.flowsDir || options.extraFlow ? { flows: { root: "apps/bot/src/flows" } } : {}),
        miniApp: {
          ...manifest.miniApp,
          entry: manifest.miniApp.entryPoint
        },
        // Only include explicit routes when NOT using flows
        ...(options.flowsDir || options.extraFlow ? {} : { routes: manifest.routes })
      },
      null,
      minifiedManifest ? undefined : 2
    )}`;
    await writeFile(
      path.join(tempRoot, configName),
      minifiedManifest ? configSource : `${configSource}\n`,
      "utf8"
    );
  }
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
    const webhookEnv = includeWebhookEnv ? "WEBHOOK_SECRET=real-secret\n" : "";
    const miniAppUrlEnv = options.blankMiniAppUrl ? "MINI_APP_URL=\n" : "";
    await writeFile(
      path.join(tempRoot, ".env"),
      `BOT_TOKEN=123:real-token\n${webhookEnv}TELEFORGE_FLOW_SECRET=real-flow-secret\nPHONE_AUTH_SECRET=real-phone-secret\n${miniAppUrlEnv}TELEFORGE_PUBLIC_URL=https://public.example.test\nTELEFORGE_DEV_HTTPS=false\n`,
      "utf8"
    );
  }

  if (options.flowsDir) {
    await mkdir(path.join(tempRoot, "apps", "bot", "src", "flows"), { recursive: true });

    // Create 0.2-style flow with miniApp routes and actions
    await writeFile(
      path.join(tempRoot, "apps", "bot", "src", "flows", "start.flow.mjs"),
      `export default {
  id: "start",
  command: { command: "start", description: "Start the bot" },
  miniApp: {
    routes: {
      "/": "welcome"
    },
    defaultRoute: "/",
    title: "Start Flow"
  },
  actions: {
    "open-app": {
      label: "Open App"
    }
  }
};\n`,
      "utf8"
    );
  }

  if (options.extraFlow) {
    await mkdir(path.join(tempRoot, "apps", "api", "src", "loaders"), { recursive: true });

    // Create loader file
    await writeFile(
      path.join(tempRoot, "apps", "api", "src", "loaders", "extra.loader.ts"),
      `export async function loader() { return { data: "test" }; }\n`,
      "utf8"
    );

    // Create extra flow with route params
    await writeFile(
      path.join(tempRoot, "apps", "bot", "src", "flows", "extra.flow.mjs"),
      `export default {
  id: "extra",
  miniApp: {
    routes: {
      "/extra": "extra",
      "/extra/:id": "extra-detail"
    },
    defaultRoute: "/extra"
  },
  actions: {
    "process-extra": {
      label: "Process"
    }
  }
};\n`,
      "utf8"
    );
  }

  if (options.clientManifest) {
    await mkdir(path.join(tempRoot, "apps", "web", "src", "teleforge-generated"), {
      recursive: true
    });

    // Generate 0.2-style manifest with flows object shape
    const flows = options.staleManifest
      ? [
          {
            id: "start",
            miniApp: {
              routes: { "/": "welcome" },
              defaultRoute: "/",
              title: "Start Flow"
            },
            screens: [
              {
                id: "welcome",
                route: "/",
                actions: ["open-app"],
                title: "Welcome",
                requiresSession: false
              }
            ]
          }
        ]
      : [
          {
            id: "start",
            miniApp: {
              routes: { "/": "welcome" },
              defaultRoute: "/",
              title: "Start Flow"
            },
            screens: [
              {
                id: "welcome",
                route: "/",
                actions: ["open-app"],
                title: "Welcome",
                requiresSession: false
              }
            ]
          },
          ...(options.extraFlow
            ? [
                {
                  id: "extra",
                  miniApp: {
                    routes: { "/extra": "extra", "/extra/:id": "extra-detail" },
                    defaultRoute: "/extra"
                  },
                  screens: [
                    {
                      id: "extra",
                      route: "/extra",
                      actions: ["process-extra"],
                      title: "Extra",
                      requiresSession: false
                    },
                    {
                      id: "extra-detail",
                      route: "/extra/:id",
                      actions: [],
                      title: "Extra Detail",
                      requiresSession: true
                    }
                  ]
                }
              ]
            : [])
        ];

    await writeFile(
      path.join(tempRoot, "apps", "web", "src", "teleforge-generated", "client-flow-manifest.ts"),
      `import { defineClientFlowManifest } from "teleforge/web";\n\nexport const flowManifest = defineClientFlowManifest(\n${JSON.stringify({ flows }, null, 2)}\n);\n`,
      "utf8"
    );

    // Also create contracts.ts file
    await writeFile(
      path.join(tempRoot, "apps", "web", "src", "teleforge-generated", "contracts.ts"),
      `// Auto-generated contracts\nexport type StartScreenId = "welcome";\n`,
      "utf8"
    );
  }

  return tempRoot;
}
