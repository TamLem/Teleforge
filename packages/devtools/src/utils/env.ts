import { readFile } from "node:fs/promises";
import path from "node:path";

export async function loadProjectEnv(cwd: string): Promise<NodeJS.ProcessEnv> {
  const fileEnv = {
    ...(await readEnvFile(path.join(cwd, ".env"))),
    ...(await readEnvFile(path.join(cwd, ".env.local")))
  };

  return {
    ...fileEnv,
    ...process.env
  };
}

export function validateRequiredEnv(env: NodeJS.ProcessEnv, keys: string[]): string[] {
  return keys.filter((key) => {
    const value = env[key];
    return typeof value !== "string" || value.trim().length === 0;
  });
}

async function readEnvFile(filePath: string): Promise<Record<string, string>> {
  try {
    const file = await readFile(filePath, "utf8");
    return file
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .reduce<Record<string, string>>((accumulator, line) => {
        const separatorIndex = line.indexOf("=");
        if (separatorIndex < 1) {
          return accumulator;
        }

        const key = line.slice(0, separatorIndex).trim();
        const rawValue = line.slice(separatorIndex + 1).trim();
        accumulator[key] = rawValue.replace(/^['"]|['"]$/g, "");
        return accumulator;
      }, {});
  } catch {
    return {};
  }
}
