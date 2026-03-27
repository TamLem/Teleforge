import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  baselinesDir,
  benchmarkDir,
  ensureDir,
  fileExists,
  formatPercent,
  readJson,
  writeJson
} from "./common.mjs";

function compareMetric(current, baseline) {
  if (!baseline || baseline === 0) {
    return null;
  }

  return ((current - baseline) / baseline) * 100;
}

function flattenResults(sizeResults, runtimeResults, memoryResults) {
  return {
    bundleSizes: sizeResults.bundles,
    memory: memoryResults,
    runtime: runtimeResults.runtime,
    treeShaking: sizeResults.treeShaking
  };
}

function buildMarkdown(summary) {
  const lines = [
    "# Teleforge Benchmark Report",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    "## Bundle Sizes",
    "",
    "| Target | Raw Bytes | Gzip Bytes | Delta |",
    "| --- | ---: | ---: | ---: |"
  ];

  for (const [name, result] of Object.entries(summary.bundleSizes)) {
    const delta = result.deltaPercent === null ? "n/a" : formatPercent(result.deltaPercent);
    lines.push(`| ${name} | ${result.rawBytes} | ${result.gzipBytes} | ${delta} |`);
  }

  lines.push(
    "",
    "## Runtime",
    "",
    "| Benchmark | Mean (ms) | Ops/sec | Delta |",
    "| --- | ---: | ---: | ---: |"
  );

  for (const [name, result] of Object.entries(summary.runtime)) {
    const delta = result.deltaPercent === null ? "n/a" : formatPercent(result.deltaPercent);
    lines.push(`| ${name} | ${result.meanMs.toFixed(6)} | ${result.hz.toFixed(2)} | ${delta} |`);
  }

  lines.push(
    "",
    "## Memory",
    "",
    `- Heap growth: ${summary.memory.growthBytes} bytes`,
    `- Limit: ${summary.memory.limitBytes} bytes`,
    `- Status: ${summary.memory.passed ? "pass" : "fail"}`
  );

  return `${lines.join("\n")}\n`;
}

const sizeResults = await readJson("results/size.json");
const runtimeResults = await readJson("results/runtime.json");
const memoryResults = await readJson("results/memory.json");
const current = flattenResults(sizeResults, runtimeResults, memoryResults);
const baselineName = process.argv.includes("--write-baseline")
  ? (process.argv[process.argv.indexOf("--write-baseline") + 1] ?? "v0.1.0")
  : "v0.1.0";
const baselinePath = path.join(baselinesDir, `${baselineName}.json`);

if (process.argv.includes("--write-baseline")) {
  await ensureDir(baselinesDir);
  await writeFile(
    baselinePath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        version: baselineName,
        ...current
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  console.log(`Baseline written to ${path.relative(benchmarkDir, baselinePath)}`);
  process.exit(0);
}

const baseline = (await fileExists(`baselines/${baselineName}.json`))
  ? JSON.parse(await readFile(baselinePath, "utf8"))
  : null;

const summary = {
  generatedAt: new Date().toISOString(),
  bundleSizes: Object.fromEntries(
    Object.entries(current.bundleSizes).map(([name, result]) => [
      name,
      {
        ...result,
        deltaPercent: compareMetric(
          result.gzipBytes,
          baseline?.bundleSizes?.[name]?.gzipBytes ?? null
        )
      }
    ])
  ),
  memory: current.memory,
  runtime: Object.fromEntries(
    Object.entries(current.runtime).map(([name, result]) => [
      name,
      {
        ...result,
        deltaPercent: compareMetric(result.meanMs, baseline?.runtime?.[name]?.meanMs ?? null)
      }
    ])
  ),
  regressions: [],
  treeShaking: current.treeShaking
};

for (const [name, result] of Object.entries(summary.bundleSizes)) {
  if (result.deltaPercent !== null && result.deltaPercent > 10) {
    summary.regressions.push(
      `${name} grew by ${formatPercent(result.deltaPercent)} gzip bytes versus baseline`
    );
  }
}

await writeJson("results/results.json", summary);
await writeFile(path.join(benchmarkDir, "results", "results.md"), buildMarkdown(summary), "utf8");

if (summary.regressions.length > 0) {
  console.error(summary.regressions.join("\n"));
  process.exit(1);
}

console.log("Benchmark report written to benchmark/results/results.json and results.md");
