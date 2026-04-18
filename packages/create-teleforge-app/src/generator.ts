import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildProjectFiles } from "./templates.js";

interface GenerateProjectOptions {
  cwd: string;
  targetDir: string;
  overwrite: boolean;
  /** When set, use `link:` protocol pointing to this local teleforge monorepo path. */
  linkPath?: string;
}

interface GenerateProjectResult {
  fileCount: number;
  relativeTargetDir: string;
  targetDir: string;
}

export async function generateProject(
  options: GenerateProjectOptions
): Promise<GenerateProjectResult> {
  const relativeTargetDir = options.targetDir.trim();

  if (!relativeTargetDir) {
    throw new Error("Project name is required.");
  }

  const targetDir = path.resolve(options.cwd, relativeTargetDir);
  const projectDirName = path.basename(targetDir);
  const exists = await directoryExists(targetDir);

  if (exists && options.overwrite) {
    await rm(targetDir, { recursive: true, force: true });
  }

  if (exists && !options.overwrite) {
    const entries = await readdir(targetDir);
    if (entries.length > 0) {
      throw new Error(
        `Target directory "${relativeTargetDir}" already exists and is not empty. Pass --overwrite to replace it.`
      );
    }
  }

  const appId = toKebabCase(projectDirName);
  const appName = toTitleCase(projectDirName);

  if (!appId || !appName) {
    throw new Error(
      `Project name "${relativeTargetDir}" must contain at least one letter or number.`
    );
  }

  const botUsername = `${appId.replace(/-/g, "_")}_bot`;

  const files = buildProjectFiles({
    appId,
    appName,
    botUsername,
    linkPath: options.linkPath
  });

  for (const [relativeFilePath, content] of Object.entries(files)) {
    const absoluteFilePath = path.join(targetDir, relativeFilePath);
    await mkdir(path.dirname(absoluteFilePath), { recursive: true });
    await writeFile(absoluteFilePath, content, "utf8");
  }

  return {
    fileCount: Object.keys(files).length,
    relativeTargetDir,
    targetDir
  };
}

async function directoryExists(targetPath: string): Promise<boolean> {
  try {
    await readdir(targetPath);
    return true;
  } catch {
    return false;
  }
}

function toKebabCase(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function toTitleCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}
