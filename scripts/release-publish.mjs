import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dryRun = process.argv.includes("--dry-run");
const npmToken =
  readOptionValue("--token") ??
  process.env.TELEFORGE_NPM_TOKEN ??
  process.env.NPM_TOKEN ??
  process.env.NODE_AUTH_TOKEN ??
  null;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const releasePackages = [
  { dir: "packages/teleforge", name: "teleforge" },
  { dir: "packages/create-teleforge-app", name: "create-teleforge-app" }
];

async function main() {
  if (!dryRun && !npmToken) {
    throw new Error(
      "Missing npm auth token. Re-run with --token=<value> or set TELEFORGE_NPM_TOKEN, NPM_TOKEN, or NODE_AUTH_TOKEN."
    );
  }

  const authConfig = await createNpmAuthConfig(npmToken);
  let publishedCount = 0;
  try {
    for (const releasePackage of releasePackages) {
      const packageDir = path.join(repoRoot, releasePackage.dir);
      const packageJsonPath = path.join(packageDir, "package.json");
      const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
      const version = packageJson.version;

      if (!version || typeof version !== "string") {
        throw new Error(`Missing version in ${packageJsonPath}`);
      }

      const published = await isVersionPublished(releasePackage.name, version, authConfig.env);
      if (published) {
        console.log(`skip ${releasePackage.name}@${version} (already published)`);
        continue;
      }

      console.log(`${dryRun ? "dry-run" : "publish"} ${releasePackage.name}@${version}`);
      await publishPackage({
        dryRun,
        env: authConfig.env,
        name: releasePackage.name,
        packageDir,
        version
      });
      publishedCount += 1;
    }

    if (publishedCount === 0) {
      console.log(`No unpublished release packages found${dryRun ? " for dry-run" : ""}.`);
    }
  } finally {
    await authConfig.cleanup();
  }
}

async function publishPackage({ dryRun, env, name, packageDir, version }) {
  const args = ["publish", "--access", "public", ...(dryRun ? ["--dry-run"] : [])];
  const result = await run("npm", args, packageDir, {
    allowFailure: true,
    env,
    forwardOutput: true,
    stdio: "pipe"
  });

  if (result.code === 0) {
    return;
  }

  throw new Error(
    `npm ${args.join(" ")} failed in ${packageDir} for ${name}@${version} with exit code ${result.code ?? "unknown"}`
  );
}

async function isVersionPublished(packageName, version, env) {
  const spec = `${packageName}@${version}`;
  const result = await run("npm", ["view", spec, "version", "--json"], repoRoot, {
    allowFailure: true,
    env,
    stdio: "pipe"
  });

  if (result.code === 0) {
    return true;
  }

  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  if (combinedOutput.includes("E404") || combinedOutput.includes("404")) {
    return false;
  }

  throw new Error(`Unable to check npm version for ${spec}:\n${combinedOutput}`.trim());
}

async function createNpmAuthConfig(token) {
  if (!token) {
    return {
      cleanup: async () => {},
      env: process.env
    };
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "teleforgex-npmrc-"));
  const userConfigPath = path.join(tempDir, ".npmrc");

  try {
    await writeFile(userConfigPath, `//registry.npmjs.org/:_authToken=${token}\n`, "utf8");
    return {
      cleanup: async () => {
        await rm(tempDir, { force: true, recursive: true });
      },
      env: {
        ...process.env,
        NODE_AUTH_TOKEN: token,
        NPM_CONFIG_USERCONFIG: userConfigPath,
        NPM_TOKEN: token,
        npm_config_userconfig: userConfigPath
      }
    };
  } catch (error) {
    await rm(tempDir, { force: true, recursive: true });
    throw error;
  }
}

function run(command, args, cwd, options = {}) {
  const {
    allowFailure = false,
    env = process.env,
    forwardOutput = false,
    stdio = "inherit"
  } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio
    });

    let stdout = "";
    let stderr = "";

    if (stdio === "pipe") {
      child.stdout?.on("data", (chunk) => {
        stdout += chunk.toString();
        if (forwardOutput) {
          process.stdout.write(chunk);
        }
      });
      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
        if (forwardOutput) {
          process.stderr.write(chunk);
        }
      });
    }

    child.once("error", reject);
    child.once("close", (code) => {
      if (!allowFailure && code !== 0) {
        reject(
          new Error(
            `${command} ${args.join(" ")} failed in ${cwd} with exit code ${code ?? "unknown"}`
          )
        );
        return;
      }

      resolve({
        code: code ?? 0,
        stderr,
        stdout
      });
    });
  });
}

function readOptionValue(flagName) {
  const prefixed = `${flagName}=`;

  for (let index = 0; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg === flagName) {
      return process.argv[index + 1] ?? null;
    }
    if (arg?.startsWith(prefixed)) {
      return arg.slice(prefixed.length);
    }
  }

  return null;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
