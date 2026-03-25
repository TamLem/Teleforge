import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const benchmarkDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const repoRoot = path.resolve(benchmarkDir, "..");
export const resultsDir = path.join(benchmarkDir, "results");
export const baselinesDir = path.join(benchmarkDir, "baselines");

export async function ensureDir(target) {
  await mkdir(target, { recursive: true });
}

export async function writeJson(relativePath, value) {
  const target = path.join(benchmarkDir, relativePath);
  await ensureDir(path.dirname(target));
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readJson(relativePath) {
  const target = path.join(benchmarkDir, relativePath);
  const raw = await readFile(target, "utf8");
  return JSON.parse(raw);
}

export async function fileExists(relativePath) {
  try {
    await readFile(path.join(benchmarkDir, relativePath), "utf8");
    return true;
  } catch {
    return false;
  }
}

export function formatPercent(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
