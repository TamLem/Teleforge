import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dryRun = process.argv.includes("--dry-run");

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
    await run(
      "npm",
      ["publish", "--access", "public", ...(dryRun ? ["--dry-run"] : [])],
      packageDir
    );
    publishedCount += 1;
  }

  if (publishedCount === 0) {
    console.log(`No unpublished release packages found${dryRun ? " for dry-run" : ""}.`);
  }
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

function run(command, args, cwd, options = {}) {
  const { allowFailure = false, stdio = "inherit" } = options;

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
      });
      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
