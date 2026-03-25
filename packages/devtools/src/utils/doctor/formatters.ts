import type { DoctorCheck, DoctorRunResult } from "./checks.js";

const categoryOrder: DoctorCheck["category"][] = [
  "Environment",
  "Configuration",
  "Connectivity",
  "BotFather"
];

export function formatDoctorReport(
  result: DoctorRunResult,
  options: { verbose: boolean }
): string {
  const lines = [`Teleforge Doctor`, `Project: ${result.cwd}`, ""];

  for (const category of categoryOrder) {
    const checks = result.checks.filter((check) => check.category === category);
    if (checks.length === 0) {
      continue;
    }

    lines.push(`${formatSymbol(groupStatus(checks))} ${category}`);

    for (const check of checks) {
      lines.push(`  ${formatSymbol(check.status)} ${check.message}`);

      if ((options.verbose || check.status !== "pass") && check.details) {
        for (const detail of check.details) {
          lines.push(`    ${detail}`);
        }
      }

      if (check.status !== "pass" && check.remediation) {
        lines.push(`    Remediation: ${check.remediation}`);
      }
    }

    lines.push("");
  }

  if (result.fixes.length > 0) {
    lines.push("Applied fixes:");
    for (const fix of result.fixes) {
      lines.push(`  ${fix.applied ? "✓" : "•"} ${fix.description}`);
    }
    lines.push("");
  }

  lines.push(
    `Summary: ${result.summary.pass} passed, ${result.summary.warn} warnings, ${result.summary.error} errors`
  );

  return lines.join("\n");
}

function formatSymbol(status: "pass" | "warn" | "error"): string {
  if (status === "pass") {
    return "✓";
  }

  if (status === "warn") {
    return "⚠";
  }

  return "✗";
}

function groupStatus(checks: DoctorCheck[]): "pass" | "warn" | "error" {
  if (checks.some((check) => check.status === "error")) {
    return "error";
  }

  if (checks.some((check) => check.status === "warn")) {
    return "warn";
  }

  return "pass";
}
