import { manifestSchema } from "./schema.js";

import type { TeleforgeManifest } from "./types.js";
import type { ZodIssue } from "zod";

export interface ManifestValidationIssue {
  message: string;
  path: string[];
}

export interface ValidateManifestSuccess {
  data: TeleforgeManifest;
  success: true;
}

export interface ValidateManifestFailure {
  errors: ManifestValidationIssue[];
  success: false;
}

export type ValidateManifestResult = ValidateManifestSuccess | ValidateManifestFailure;

export function validateManifest(manifest: unknown): ValidateManifestResult {
  const result = manifestSchema.safeParse(manifest);

  if (!result.success) {
    return {
      errors: result.error.issues.map(formatIssue),
      success: false
    };
  }

  return {
    data: result.data,
    success: true
  };
}

function formatIssue(issue: ZodIssue): ManifestValidationIssue {
  return {
    message: issue.message,
    path: issue.path.map((segment) => String(segment))
  };
}
