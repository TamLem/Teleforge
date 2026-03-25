import type { ManifestValidationIssue } from "../manifest/validate.js";

export class ManifestValidationError extends Error {
  readonly issues: ManifestValidationIssue[];

  constructor(issues: ManifestValidationIssue[]) {
    super(formatIssues(issues));
    this.name = "ManifestValidationError";
    this.issues = issues;
  }
}

function formatIssues(issues: ManifestValidationIssue[]): string {
  return issues
    .map((issue) => {
      const prefix = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${prefix}${issue.message}`;
    })
    .join("; ");
}
