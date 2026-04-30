#!/usr/bin/env node

import process from "node:process";

import { runDevCommand, type DevCommandFlags } from "./commands/dev.js";
import { runDevHttpsCommand, type DevHttpsCommandFlags } from "./commands/devHttps.js";
import { runDoctorCommand, type DoctorCommandFlags } from "./commands/doctor.js";
import { runGenerateCommand, type GenerateCommandFlags } from "./commands/generate.js";

import type { TunnelProvider } from "./utils/tunnel.js";

interface ParsedArgs {
  command?: string;
  flags: Record<string, string | boolean>;
  subcommand?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  let subcommand: string | undefined;

  if (command === "--help" || command === "-h") {
    return { flags: { help: true } };
  }

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (!arg?.startsWith("-")) {
      if (subcommand === undefined && command === "generate") {
        subcommand = arg;
      }
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      flags.help = true;
      continue;
    }

    if (arg === "--https") {
      flags.https = true;
      continue;
    }

    if (arg === "--no-https") {
      flags.https = false;
      continue;
    }

    if (arg === "--tunnel") {
      flags.tunnel = true;
      continue;
    }

    if (arg === "--no-tunnel") {
      flags.tunnel = false;
      continue;
    }

    if (arg === "--open") {
      flags.open = true;
      continue;
    }

    if (arg === "--no-open") {
      flags.open = false;
      continue;
    }

    if (arg === "--port") {
      flags.port = rest[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "-p") {
      flags.port = rest[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg.startsWith("--port=")) {
      flags.port = arg.split("=")[1] ?? "";
      continue;
    }

    if (arg === "--public") {
      flags.public = true;
      continue;
    }

    if (arg === "--no-public") {
      flags.public = false;
      continue;
    }

    if (arg === "--live") {
      flags.live = true;
      continue;
    }

    if (arg === "--no-live") {
      flags.live = false;
      continue;
    }

    if (arg === "--qr") {
      flags.qr = true;
      continue;
    }

    if (arg === "--no-qr") {
      flags.qr = false;
      continue;
    }

    if (arg === "--webhook") {
      flags.webhook = true;
      continue;
    }

    if (arg === "--no-webhook") {
      flags.webhook = false;
      continue;
    }

    if (arg === "--subdomain") {
      flags.subdomain = rest[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--fix") {
      flags.fix = true;
      continue;
    }

    if (arg === "--json") {
      flags.json = true;
      continue;
    }

    if (arg === "--verbose") {
      flags.verbose = true;
      continue;
    }

    if (arg === "--output") {
      flags.output = rest[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg.startsWith("--output=")) {
      flags.output = arg.split("=")[1] ?? "";
      continue;
    }

    if (arg.startsWith("--subdomain=")) {
      flags.subdomain = arg.split("=")[1] ?? "";
      continue;
    }

    if (arg === "--tunnel-provider") {
      flags.tunnelProvider = rest[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg.startsWith("--tunnel-provider=")) {
      flags.tunnelProvider = arg.split("=")[1] ?? "";
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { command, flags, subcommand };
}

function printHelp(): void {
  console.log(`teleforge

Usage:
  teleforge dev [options]
  teleforge dev:https [options]  Legacy alias for \`teleforge dev --public --live\`
  teleforge generate <subcommand> [options]
  teleforge doctor [options]

Options:
  --port <number>  Override the external dev port
  --open           Open the dev URL in the default browser
  --public         Expose the Mini App through HTTPS and a public tunnel
  --live           Use Telegram-facing local development defaults
  --https          Enable HTTPS explicitly
  --no-https       Disable HTTPS proxying explicitly
  --tunnel         Enable tunneling explicitly
  --qr             Render a terminal QR code
  --webhook        Auto-configure the bot webhook when a local webhook service exists
  --subdomain      Request a tunnel subdomain when supported by the provider
  --tunnel-provider <provider>  Select cloudflare, localtunnel, or ngrok
  --fix            Apply safe doctor fixes
  --json           Emit doctor output as JSON
  --verbose        Show detailed doctor output
  --output <path>  Write generated output to a specific file path
  --help, -h       Show this help
`);
}

function toDevFlags(flags: Record<string, string | boolean>): Omit<DevCommandFlags, "cwd"> {
  const portValue = flags.port;
  const publicMode = typeof flags.public === "boolean" ? flags.public : false;
  const tunnelProvider = flags.tunnelProvider;
  return {
    open: typeof flags.open === "boolean" ? flags.open : false,
    port:
      typeof portValue === "string" && portValue.length > 0
        ? Number.parseInt(portValue, 10)
        : undefined,
    https: publicMode ? true : typeof flags.https === "boolean" ? flags.https : false,
    qr: typeof flags.qr === "boolean" ? flags.qr : publicMode,
    subdomain:
      typeof flags.subdomain === "string" && flags.subdomain.length > 0
        ? flags.subdomain
        : undefined,
    tunnel: publicMode ? true : typeof flags.tunnel === "boolean" ? flags.tunnel : false,
    tunnelProvider:
      tunnelProvider === "cloudflare" ||
      tunnelProvider === "ngrok" ||
      tunnelProvider === "localtunnel"
        ? (tunnelProvider as TunnelProvider)
        : "cloudflare",
    webhook: typeof flags.webhook === "boolean" ? flags.webhook : false
  };
}

function toDevHttpsFlags(
  flags: Record<string, string | boolean>
): Omit<DevHttpsCommandFlags, "cwd"> {
  return {
    ...toDevFlags(flags),
    open: typeof flags.open === "boolean" ? flags.open : false
  };
}

function toDoctorFlags(flags: Record<string, string | boolean>): Omit<DoctorCommandFlags, "cwd"> {
  return {
    fix: typeof flags.fix === "boolean" ? flags.fix : false,
    json: typeof flags.json === "boolean" ? flags.json : false,
    verbose: typeof flags.verbose === "boolean" ? flags.verbose : false
  };
}

function toGenerateFlags(flags: Record<string, string | boolean>): Omit<GenerateCommandFlags, "cwd"> {
  return {
    outputPath:
      typeof flags.output === "string" && flags.output.length > 0 ? flags.output : undefined
  };
}

async function main(): Promise<void> {
  const { command, flags, subcommand } = parseArgs(process.argv.slice(2));

  if (flags.help || !command) {
    printHelp();
    return;
  }

  if (command === "dev") {
    await runDevCommand({
      cwd: process.cwd(),
      ...toDevFlags(flags)
    });
    return;
  }

  if (command === "dev:https") {
    await runDevHttpsCommand({
      cwd: process.cwd(),
      ...toDevHttpsFlags(flags)
    });
    return;
  }

  if (command === "doctor") {
    await runDoctorCommand({
      cwd: process.cwd(),
      ...toDoctorFlags(flags)
    });
    return;
  }

  if (command === "generate") {
    await runGenerateCommand({
      cwd: process.cwd(),
      subcommand: subcommand,
      ...toGenerateFlags(flags)
    });
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
