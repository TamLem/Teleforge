import process from "node:process";

import { generateProject } from "../../create-teleforge-app/src/generator.js";

import {
  createTeleforgeRuntimeContext,
  createTeleforgeWebhookHandler,
  startTeleforgeBot,
  startTeleforgeServer
} from "./index.js";

interface CreateCommandOptions {
  linkPath?: string;
  overwrite: boolean;
  targetDir?: string;
  yes: boolean;
}

function parseCreateCommandArgs(argv: string[]): CreateCommandOptions {
  const options: CreateCommandOptions = {
    overwrite: false,
    yes: false
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
      printCreateCommandHelp();
      process.exit(0);
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

    throw new Error(`Unknown argument for teleforge create: ${arg}`);
  }

  return options;
}

function printCreateCommandHelp(): void {
  console.log(`teleforge create

Usage:
  teleforge create <project-name> [options]

Options:
  --overwrite                   Remove an existing target directory before generating
  --link <path>                 Link packages to a local teleforge monorepo
  -y, --yes                     Accept defaults without prompts
  -h, --help                    Show help`);
}

function printHelp(): void {
  console.log(`teleforge

Usage:
  teleforge create <project-name> [options]
  teleforge dev [options]
  teleforge start
  teleforge generate <subcommand> [options]
  teleforge doctor [options]

Commands:
  create        Scaffold a new Teleforge app
  dev           Run the local development server
  start         Run the production bot/action server bootstrap
  generate      Generate client manifest and typed contracts
  doctor        Diagnose configuration, manifest drift, and environment issues

Run \`teleforge create --help\` for scaffold options.
Run \`teleforge <command> --help\` for command-specific help.`);
}

async function runCreateCommand(argv: string[]): Promise<void> {
  const options = parseCreateCommandArgs(argv);

  if (!options.targetDir) {
    if (options.yes) {
      throw new Error("Project name is required when using --yes.");
    }
    throw new Error("Project name is required.");
  }

  const result = await generateProject({
    cwd: process.cwd(),
    linkPath: options.linkPath,
    overwrite: options.overwrite,
    targetDir: options.targetDir.trim()
  });

  console.log(`
Created Teleforge project in ${result.targetDir}
Files written: ${result.fileCount}

Next steps:
  cd ${result.relativeTargetDir}
  pnpm install
  pnpm run generate
  pnpm run dev
  pnpm run doctor`);
}

async function runStartCommand(): Promise<void> {
  const cwd = process.cwd();

  const context = await createTeleforgeRuntimeContext({ cwd });
  const delivery = context.app.runtime.bot?.delivery ?? "polling";
  const needsServer = Boolean(context.app.miniApp) || delivery === "webhook";

  const { runtime: botRuntime, stop: stopBot } = await startTeleforgeBot({
    app: context.app,
    cwd,
    flowSecret: context.flowSecret,
    miniAppUrl: context.miniAppUrl,
    phoneAuthSecret: context.phoneAuthSecret,
    services: context.services,
    sessionManager: context.sessionManager,
    token: context.token
  });

  let stopServer: (() => void) | undefined;

  if (needsServer) {
    const additionalRoutes: NonNullable<
      Parameters<typeof startTeleforgeServer>[0]
    >["additionalRoutes"] = [];

    if (delivery === "webhook") {
      const webhookPath = context.app.bot.webhook?.path;

      if (webhookPath) {
        additionalRoutes!.push({
          handler: await createTeleforgeWebhookHandler({
            app: context.app,
            cwd,
            flowSecret: context.flowSecret,
            miniAppUrl: context.miniAppUrl,
            phoneAuthSecret: context.phoneAuthSecret,
            services: context.services,
            sessionManager: context.sessionManager
          }),
          path: webhookPath
        });
        console.log(`[teleforge:start] webhook endpoint mounted at ${webhookPath}`);
      }
    }

    const server = await startTeleforgeServer({
      additionalRoutes,
      flowSecret: context.flowSecret,
      onChatHandoff: (input) => {
        botRuntime.handleChatHandoff({ context: input.context, message: input.message });
      },
      port: context.app.runtime.server?.port,
      services: context.services,
      sessionManager: context.sessionManager
    });

    stopServer = server.stop;
    console.log(`[teleforge:start] action server running at ${server.url}`);
  }

  console.log(
    `[teleforge:start] bot running (${botRuntime.getCommands().length} command(s) registered)`
  );

  const shutdown = () => {
    console.log("\n[teleforge:start] shutting down...");
    stopBot();
    stopServer?.();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await new Promise(() => {});
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "create") {
    await runCreateCommand(args.slice(1));
    return;
  }

  if (command === "start") {
    await runStartCommand();
    return;
  }

  // @ts-expect-error — devtools/cli has no types
  await import("@teleforgex/devtools/cli");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
