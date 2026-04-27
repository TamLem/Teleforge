import { readFile } from "node:fs/promises";

export interface ManifestDriftResult {
  isStale: boolean;
  reason?: string;
}

export async function readClientManifestFlowIds(manifestPath: string): Promise<string[] | null> {
  let content: string;
  try {
    content = await readFile(manifestPath, "utf8");
  } catch {
    return null;
  }

  const arrayMatch = content.match(/defineClientFlowManifest\(([\s\S]*)\);?\s*$/m);
  if (!arrayMatch) {
    return null;
  }

  try {
    const parsed = JSON.parse(arrayMatch[1]) as unknown;
    let flows: Array<{ id?: unknown }>;

    if (Array.isArray(parsed)) {
      flows = parsed;
    } else if (typeof parsed === "object" && parsed !== null && "flows" in parsed && Array.isArray((parsed as Record<string, unknown>).flows)) {
      flows = (parsed as Record<string, unknown>).flows as Array<{ id?: unknown }>;
    } else {
      return null;
    }

    const flowIds: string[] = [];
    for (const item of flows) {
      if (typeof item !== "object" || item === null) {
        return null;
      }
      const id = (item as { id?: unknown }).id;
      if (typeof id !== "string") {
        return null;
      }
      flowIds.push(id);
    }

    return flowIds;
  } catch {
    return null;
  }
}

export async function checkClientManifestDrift(options: {
  discoveredFlows: Array<{ id: string }>;
  manifestPath: string;
}): Promise<ManifestDriftResult> {
  const { discoveredFlows, manifestPath } = options;

  if (discoveredFlows.length === 0) {
    return { isStale: false };
  }

  const manifestFlowIds = await readClientManifestFlowIds(manifestPath);
  if (manifestFlowIds === null) {
    return { isStale: true, reason: "client manifest file is missing or unreadable" };
  }

  const discoveredFlowIds = new Set(discoveredFlows.map((flow) => flow.id));
  const manifestFlowIdSet = new Set(manifestFlowIds);

  for (const flowId of discoveredFlowIds) {
    if (!manifestFlowIdSet.has(flowId)) {
      return { isStale: true, reason: `flow "${flowId}" is missing from manifest` };
    }
  }

  for (const flowId of manifestFlowIdSet) {
    if (!discoveredFlowIds.has(flowId)) {
      return { isStale: true, reason: `stale flow "${flowId}" in manifest` };
    }
  }

  return { isStale: false };
}
