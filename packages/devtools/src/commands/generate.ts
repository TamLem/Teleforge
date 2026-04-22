import { generateClientManifest } from "../utils/generate-manifest.js";

export interface GenerateCommandFlags {
  cwd: string;
  outputPath?: string;
  subcommand?: string;
}

export async function runGenerateCommand(flags: GenerateCommandFlags): Promise<void> {
  if (flags.subcommand === "client-manifest") {
    const outputPath = await generateClientManifest({
      cwd: flags.cwd,
      outputPath: flags.outputPath
    });
    console.log(`Generated client flow manifest: ${outputPath}`);
    return;
  }

  throw new Error(
    `Unknown generate subcommand: ${flags.subcommand ?? "(none)"}. Supported: client-manifest`
  );
}
