import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { generateContracts } from "./generate-contracts.js";
import { resolveTeleforgeImportPath, resolveTsxImportPath } from "./manifest.js";

const execFileAsync = promisify(execFile);

export interface GenerateClientManifestOptions {
  cwd: string;
  outputPath?: string;
  contractsOutputPath?: string;
}

export async function generateClientManifest(
  options: GenerateClientManifestOptions
): Promise<string> {
  const cwd = options.cwd;
  const outputPath =
    options.outputPath ??
    path.join(cwd, "apps", "web", "src", "teleforge-generated", "client-flow-manifest.ts");
  const contractsOutputPath =
    options.contractsOutputPath ?? path.join(path.dirname(outputPath), "contracts.ts");

  const teleforgeImportPath = resolveTeleforgeImportPath(cwd);
  const tsxImportPath = resolveTsxImportPath(cwd);

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teleforge-"));
  const jsonOutputPath = path.join(tmpDir, "output.json");

  const script = `
    import { writeFile } from "node:fs/promises";
    import { pathToFileURL } from "node:url";

    const teleforgePath = process.env.TELEFORGE_PACKAGE_PATH;
    const cwd = process.env.TELEFORGE_CWD;
    const outputPath = process.env.TELEFORGE_OUTPUT_PATH;
    if (!teleforgePath || !cwd || !outputPath) {
      throw new Error("Required environment variables are missing.");
    }

    const teleforge = await import(pathToFileURL(teleforgePath).href);
    const configPath = await teleforge.resolveTeleforgeConfigPath(cwd);
    if (!configPath) {
      throw new Error("No Teleforge project found. Add a teleforge.config.ts file.");
    }
    const app = await teleforge.loadTeleforgeAppFromFile(configPath);
    const flows = await teleforge.loadTeleforgeFlows({ app, cwd });
    const manifest = teleforge.createClientFlowManifest(flows);
    await writeFile(outputPath, JSON.stringify(manifest));
  `;

  try {
    await execFileAsync(
      process.execPath,
      ["--import", tsxImportPath, "--input-type=module", "--eval", script],
      {
        cwd,
        env: {
          ...process.env,
          TELEFORGE_CWD: cwd,
          TELEFORGE_PACKAGE_PATH: teleforgeImportPath,
          TELEFORGE_OUTPUT_PATH: jsonOutputPath
        }
      }
    );

    const manifestPayload = JSON.parse(await readFile(jsonOutputPath, "utf8")) as {
      flows: Array<{
        id: string;
        miniApp?: { defaultRoute?: string; routes: Record<string, string>; title?: string };
        screens: Array<{
          id: string;
          route?: string;
          actions?: string[];
          title?: string;
          requiresSession?: boolean;
        }>;
      }>;
    };
    const fileContent = formatGeneratedManifest(manifestPayload);

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, fileContent, "utf8");

    await generateContracts({
      manifest: manifestPayload,
      outputPath: contractsOutputPath
    });

    return outputPath;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

function formatGeneratedManifest(manifest: unknown): string {
  return `import { defineClientFlowManifest } from "teleforge/web";

export const flowManifest = defineClientFlowManifest(
  ${JSON.stringify(manifest, null, 2)}
);
`;
}
