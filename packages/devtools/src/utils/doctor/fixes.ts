import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface DoctorFix {
  applied: boolean;
  description: string;
  name: string;
}

export async function applyDoctorFixes(cwd: string): Promise<DoctorFix[]> {
  const fixes: DoctorFix[] = [];
  const envPath = path.join(cwd, ".env");
  const envExamplePath = path.join(cwd, ".env.example");
  const configPath = path.join(cwd, "teleforge.config.ts");

  if (!(await pathExists(envPath)) && (await pathExists(envExamplePath))) {
    await copyFile(envExamplePath, envPath);
    fixes.push({
      applied: true,
      description: "Created .env from .env.example.",
      name: "create_env_file"
    });
  }

  if (await pathExists(configPath)) {
    try {
      const raw = await readFile(configPath, "utf8");
      if (!raw.endsWith("\n")) {
        await writeFile(configPath, `${raw}\n`, "utf8");
        fixes.push({
          applied: true,
          description: "Ensured teleforge.config.ts ends with a newline.",
          name: "format_manifest"
        });
      }
    } catch {
      fixes.push({
        applied: false,
        description: "Skipped teleforge.config.ts formatting.",
        name: "format_manifest"
      });
    }
  }

  return fixes;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath, "utf8");
    return true;
  } catch {
    return false;
  }
}
