import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const dryRun = process.argv.includes("--dry-run");
const initialOtp = readOptionValue("--otp") ?? process.env.TELEFORGE_NPM_OTP ?? null;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const releasePackages = [
  { dir: "packages/core", name: "@teleforge/core" },
  { dir: "packages/web", name: "@teleforge/web" },
  { dir: "packages/ui", name: "@teleforge/ui" },
  { dir: "packages/bot", name: "@teleforge/bot" },
  { dir: "packages/bff", name: "@teleforge/bff" },
  { dir: "packages/devtools", name: "@teleforge/devtools" }
];

async function main() {
  let publishedCount = 0;
  let otp = initialOtp;

  for (const releasePackage of releasePackages) {
    const packageDir = path.join(repoRoot, releasePackage.dir);
    const packageJsonPath = path.join(packageDir, "package.json");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
    const version = packageJson.version;

    if (!version || typeof version !== "string") {
      throw new Error(`Missing version in ${packageJsonPath}`);
    }

    const published = await isVersionPublished(releasePackage.name, version);
    if (published) {
      console.log(`skip ${releasePackage.name}@${version} (already published)`);
      continue;
    }

    console.log(`${dryRun ? "dry-run" : "publish"} ${releasePackage.name}@${version}`);
    otp = await publishPackage({
      currentOtp: otp,
      dryRun,
      name: releasePackage.name,
      packageDir,
      version
    });
    publishedCount += 1;
  }

  if (publishedCount === 0) {
    console.log(`No unpublished release packages found${dryRun ? " for dry-run" : ""}.`);
  }
}

async function publishPackage({ currentOtp, dryRun, name, packageDir, version }) {
  let otp = currentOtp;
  let shouldRetry = true;

  while (shouldRetry) {
    shouldRetry = false;
    const args = ["publish", "--access", "public", ...(dryRun ? ["--dry-run"] : [])];
    if (otp) {
      args.push(`--otp=${otp}`);
    }

    const result = await run("npm", args, packageDir, {
      allowFailure: true,
      forwardOutput: true,
      stdio: "pipe"
    });

    if (result.code === 0) {
      return otp;
    }

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    if (!dryRun && combinedOutput.includes("EOTP")) {
      otp = await promptForOtp(`${name}@${version}`);
      shouldRetry = true;
      continue;
    }

    throw new Error(
      `npm ${args.join(" ")} failed in ${packageDir} with exit code ${result.code ?? "unknown"}`
    );
  }

  throw new Error(`npm publish retry loop exited unexpectedly for ${name}@${version}`);
}

async function isVersionPublished(packageName, version) {
  const spec = `${packageName}@${version}`;
  const result = await run("npm", ["view", spec, "version", "--json"], repoRoot, {
    allowFailure: true,
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

async function promptForOtp(packageLabel) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      `npm requested a one-time password for ${packageLabel}, but no interactive terminal is available. Re-run with --otp=<code> or TELEFORGE_NPM_OTP set.`
    );
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const otp = (await rl.question(`Enter npm OTP for ${packageLabel}: `)).trim();
    if (!otp) {
      throw new Error("A non-empty npm OTP is required to continue publishing.");
    }
    return otp;
  } finally {
    rl.close();
  }
}

function run(command, args, cwd, options = {}) {
  const { allowFailure = false, forwardOutput = false, stdio = "inherit" } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
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
