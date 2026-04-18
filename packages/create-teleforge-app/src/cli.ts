#!/usr/bin/env node

import { stdout as output } from "node:process";

import { generateProject } from "./generator.js";

interface CliOptions {
  targetDir?: string;
  /** When set, use `link:` protocol pointing to this local teleforge monorepo path. */
  linkPath?: string;
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

    if (arg === "--link") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("Expected a path after --link.");
      }
      options.linkPath = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--link=")) {
      options.linkPath = arg.split("=")[1] || "";
      if (!options.linkPath) {
        throw new Error("Expected a path after --link=.");
      }
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp(): void {
  output.write(`create-teleforge-app\n\n`);
  output.write(`Usage:\n`);
  output.write(`  create-teleforge-app <project-name> [options]\n\n`);
  output.write(`Options:\n`);
  output.write(
    `  --overwrite                   Remove an existing target directory before generating\n`
  );
  output.write(`  --link <path>                 Link packages to a local teleforge monorepo\n`);
  output.write(`  -y, --yes                     Accept defaults without prompts\n`);
  output.write(`  -h, --help                    Show help\n`);
}

async function promptForMissing(options: CliOptions): Promise<Required<Pick<CliOptions, "targetDir">>> {
  if (options.yes) {
    if (!options.targetDir) {
      throw new Error("Project name is required when using --yes.");
    }

    return {
      targetDir: options.targetDir
    };
  }

  if (!options.targetDir) {
    throw new Error("Project name is required.");
  }

  return {
    targetDir: options.targetDir.trim()
  };
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
    overwrite: options.overwrite,
    linkPath: options.linkPath
  });

  output.write(`\nCreated Teleforge project in ${result.targetDir}\n`);
  output.write(`Files written: ${result.fileCount}\n\n`);
  output.write(`Next steps:\n`);
  output.write(`  cd ${result.relativeTargetDir}\n`);
  output.write(`  pnpm install\n`);
  output.write(`  pnpm run dev\n`);
  output.write(`  pnpm run doctor\n`);
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
