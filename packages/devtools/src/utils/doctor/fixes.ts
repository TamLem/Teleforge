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
  const manifestPath = path.join(cwd, "teleforge.app.json");

  if (!(await pathExists(envPath)) && (await pathExists(envExamplePath))) {
    await copyFile(envExamplePath, envPath);
    fixes.push({
      applied: true,
      description: "Created .env from .env.example.",
      name: "create_env_file"
    });
  }

  if (await pathExists(manifestPath)) {
    try {
      const raw = await readFile(manifestPath, "utf8");
      const formatted = `${JSON.stringify(JSON.parse(raw), null, 2)}\n`;
      if (formatted !== raw) {
        await writeFile(manifestPath, formatted, "utf8");
        fixes.push({
          applied: true,
          description: "Formatted teleforge.app.json.",
          name: "format_manifest"
        });
      }
    } catch {
      fixes.push({
        applied: false,
        description: "Skipped teleforge.app.json formatting because the file is not valid JSON.",
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
