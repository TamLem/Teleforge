import type { TeleforgeSessionProviderConfig } from "./types.js";
import type {
  TeleforgeDeploymentTopology,
  TeleforgeRuntime,
  TeleforgeRuntimeEnvironment
} from "../manifest/types.js";

export interface TeleforgeRuntimeDeployment {
  environment: TeleforgeRuntimeEnvironment;
  topology: TeleforgeDeploymentTopology;
}

export interface ResolveRuntimeDeploymentOptions {
  env?: Record<string, string | undefined>;
}

export interface TeleforgeSessionDeploymentInput {
  environment: TeleforgeRuntimeEnvironment;
  topology: TeleforgeDeploymentTopology;
  sessionConfig?: Pick<TeleforgeSessionProviderConfig, "provider">;
  sessionEnabledFlows: readonly string[];
}

export type TeleforgeSessionDeploymentIssueCode =
  | "SESSION_PROVIDER_MISSING"
  | "MEMORY_REQUIRES_SINGLE_PROCESS"
  | "MEMORY_REQUIRES_NON_PRODUCTION";

export interface TeleforgeSessionDeploymentIssue {
  code: TeleforgeSessionDeploymentIssueCode;
  details: string[];
  message: string;
  remediation: string;
}

export type TeleforgeSessionDeploymentValidationResult =
  | { ok: true; issues: [] }
  | { ok: false; issues: TeleforgeSessionDeploymentIssue[] };

const environments = new Set<TeleforgeRuntimeEnvironment>([
  "development",
  "preview",
  "staging",
  "production"
]);

const topologies = new Set<TeleforgeDeploymentTopology>([
  "single-process",
  "split-process",
  "serverless",
  "multi-instance"
]);

export function resolveRuntimeDeployment(
  runtime: Pick<TeleforgeRuntime, "environment" | "deployment">,
  options: ResolveRuntimeDeploymentOptions = {}
): TeleforgeRuntimeDeployment {
  const rawEnvironment = runtime.environment ?? options.env?.TELEFORGE_ENV ?? "development";
  const rawTopology = runtime.deployment?.topology ?? "single-process";

  if (!environments.has(rawEnvironment as TeleforgeRuntimeEnvironment)) {
    throw new Error(
      `Invalid Teleforge runtime environment "${rawEnvironment}". Expected one of: ${[...environments].join(", ")}.`
    );
  }

  if (!topologies.has(rawTopology as TeleforgeDeploymentTopology)) {
    throw new Error(
      `Invalid Teleforge deployment topology "${rawTopology}". Expected one of: ${[...topologies].join(", ")}.`
    );
  }

  return {
    environment: rawEnvironment as TeleforgeRuntimeEnvironment,
    topology: rawTopology as TeleforgeDeploymentTopology
  };
}

export function validateSessionDeployment(
  input: TeleforgeSessionDeploymentInput
): TeleforgeSessionDeploymentValidationResult {
  const sessionEnabledFlows = [...input.sessionEnabledFlows];
  const issues: TeleforgeSessionDeploymentIssue[] = [];

  if (sessionEnabledFlows.length === 0) {
    return { ok: true, issues: [] };
  }

  const flowList = formatFlowList(sessionEnabledFlows);

  if (!input.sessionConfig) {
    issues.push({
      code: "SESSION_PROVIDER_MISSING",
      details: [`Session-enabled flows: ${sessionEnabledFlows.join(", ")}`],
      message: `Flow ${flowList} enables sessions, but teleforge.config.ts has no session provider.`,
      remediation:
        `Add session: { provider: "memory" } only for local single-process development, ` +
        `or configure a durable custom provider for split/API/serverless/production deployments.`
    });
    return { ok: false, issues };
  }

  if (input.sessionConfig.provider === "memory" && input.topology !== "single-process") {
    issues.push({
      code: "MEMORY_REQUIRES_SINGLE_PROCESS",
      details: [
        `Session-enabled flows: ${sessionEnabledFlows.join(", ")}`,
        `Deployment topology: ${input.topology}`
      ],
      message:
        `Flow ${flowList} uses sessions with provider "memory", but ` +
        `runtime.deployment.topology is "${input.topology}".`,
      remediation:
        `Memory sessions only work when bot actions and server hooks/loaders run in the same process. ` +
        `Configure a durable custom session provider.`
    });
  }

  if (input.sessionConfig.provider === "memory" && input.environment === "production") {
    issues.push({
      code: "MEMORY_REQUIRES_NON_PRODUCTION",
      details: [
        `Session-enabled flows: ${sessionEnabledFlows.join(", ")}`,
        `Runtime environment: ${input.environment}`
      ],
      message:
        `Flow ${flowList} uses sessions with provider "memory", but runtime.environment is "production".`,
      remediation:
        `Memory sessions are not durable and cannot be used for production deployments. ` +
        `Configure a durable custom session provider.`
    });
  }

  return issues.length === 0
    ? { ok: true, issues: [] }
    : { ok: false, issues };
}

function formatFlowList(flowIds: readonly string[]): string {
  if (flowIds.length === 1) {
    return `"${flowIds[0]}"`;
  }

  return `${flowIds.slice(0, -1).map((id) => `"${id}"`).join(", ")} and "${flowIds[flowIds.length - 1]}"`;
}
