#!/usr/bin/env node

import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import { generateProject, type GeneratorMode, type PackageManager } from "./generator.js";

interface CliOptions {
  targetDir?: string;
  mode?: GeneratorMode;
  packageManager?: PackageManager;
  overwrite: boolean;
  yes: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    overwrite: false,
    yes: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg) {
      continue;
    }

    if (!arg.startsWith("-") && !options.targetDir) {
      options.targetDir = arg;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--yes" || arg === "-y") {
      options.yes = true;
      continue;
    }

    if (arg === "--overwrite") {
      options.overwrite = true;
      continue;
    }

    if (arg === "--mode" || arg === "-m") {
      options.mode = parseMode(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith("--mode=")) {
      options.mode = parseMode(arg.split("=")[1]);
      continue;
    }

    if (arg === "--package-manager" || arg === "-p") {
      options.packageManager = parsePackageManager(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith("--package-manager=")) {
      options.packageManager = parsePackageManager(arg.split("=")[1]);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function parseMode(value?: string): GeneratorMode {
  if (value === "spa" || value === "bff") {
    return value;
  }

  throw new Error(`Expected --mode to be "spa" or "bff", received "${value ?? ""}".`);
}

function parsePackageManager(value?: string): PackageManager {
  if (value === "npm" || value === "pnpm") {
    return value;
  }

  throw new Error(`Expected --package-manager to be "npm" or "pnpm", received "${value ?? ""}".`);
}

function inferPackageManager(): PackageManager {
  const userAgent = process.env.npm_config_user_agent ?? "";
  return userAgent.includes("pnpm") ? "pnpm" : "npm";
}

function printHelp(): void {
  output.write(`create-teleforge-app\n\n`);
  output.write(`Usage:\n`);
  output.write(`  create-teleforge-app <project-name> [options]\n\n`);
  output.write(`Options:\n`);
  output.write(`  -m, --mode <spa|bff>          Select the web runtime mode\n`);
  output.write(`  -p, --package-manager <tool>  Choose npm or pnpm for next-step commands\n`);
  output.write(
    `  --overwrite                   Remove an existing target directory before generating\n`
  );
  output.write(`  -y, --yes                     Accept defaults without prompts\n`);
  output.write(`  -h, --help                    Show help\n`);
}

async function promptForMissing(
  options: CliOptions
): Promise<Required<Pick<CliOptions, "targetDir" | "mode" | "packageManager">>> {
  if (options.yes) {
    if (!options.targetDir) {
      throw new Error("Project name is required when using --yes.");
    }

    return {
      targetDir: options.targetDir,
      mode: options.mode ?? "spa",
      packageManager: options.packageManager ?? inferPackageManager()
    };
  }

  if (!input.isTTY || !output.isTTY) {
    throw new Error(
      "Missing required arguments in a non-interactive terminal. Pass --mode and a project name."
    );
  }

  const prompt = createInterface({ input, output });

  try {
    const targetDir = options.targetDir?.trim() || (await prompt.question("Project name: ")).trim();

    if (!targetDir) {
      throw new Error("Project name is required.");
    }

    const mode = options.mode ?? (await promptMode(prompt));

    const packageManager = options.packageManager ?? inferPackageManager();

    return {
      targetDir,
      mode,
      packageManager
    };
  } finally {
    prompt.close();
  }
}

async function promptMode(prompt: ReturnType<typeof createInterface>): Promise<GeneratorMode> {
  const answer = (await prompt.question("Template mode (spa/bff) [spa]: ")).trim().toLowerCase();
  return answer === "bff" ? "bff" : "spa";
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const resolved = await promptForMissing(options);
  const result = await generateProject({
    cwd: process.cwd(),
    targetDir: resolved.targetDir,
    mode: resolved.mode,
    overwrite: options.overwrite,
    packageManager: resolved.packageManager
  });

  output.write(`\nCreated Teleforge project in ${result.targetDir}\n`);
  output.write(`Mode: ${result.mode.toUpperCase()}\n`);
  output.write(`Files written: ${result.fileCount}\n\n`);
  output.write(`Next steps:\n`);
  output.write(`  cd ${result.relativeTargetDir}\n`);
  output.write(`  ${result.packageManager} install\n`);
  output.write(`  ${result.packageManager} run dev\n`);
  output.write(`  ${result.packageManager} run doctor\n`);
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
