import { copyFile, readFile } from "node:fs/promises";
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

  if (!(await pathExists(envPath)) && (await pathExists(envExamplePath))) {
    await copyFile(envExamplePath, envPath);
    fixes.push({
      applied: true,
      description: "Created .env from .env.example.",
      name: "create_env_file"
    });
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
