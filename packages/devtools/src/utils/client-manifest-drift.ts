import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export interface ManifestDriftResult {
  isStale: boolean;
  reason?: string;
  details?: string[];
}

export interface ClientFlowManifest {
  flows: ReadonlyArray<{
    id: string;
    miniApp?: {
      defaultRoute?: string;
      routes: Record<string, string>;
      title?: string;
    };
    screens: ReadonlyArray<{
      id: string;
      route?: string;
      actions?: readonly string[];
      title?: string;
      requiresSession?: boolean;
    }>;
  }>;
}

export async function readClientManifest(manifestPath: string): Promise<ClientFlowManifest | null> {
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

    // 0.2 requires { flows: [...] } shape, reject old array format
    if (Array.isArray(parsed)) {
      return null;
    }

    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    const manifest = parsed as Record<string, unknown>;
    if (!("flows" in manifest) || !Array.isArray(manifest.flows)) {
      return null;
    }

    // Validate manifest structure
    const flows = manifest.flows as Array<unknown>;
    for (const item of flows) {
      if (typeof item !== "object" || item === null) {
        return null;
      }
      const flow = item as Record<string, unknown>;
      if (typeof flow.id !== "string") {
        return null;
      }
      // Validate required fields for 0.2
      if (!Array.isArray(flow.screens)) {
        return null;
      }
    }

    return parsed as ClientFlowManifest;
  } catch {
    return null;
  }
}

export async function readClientManifestFlowIds(manifestPath: string): Promise<string[] | null> {
  const manifest = await readClientManifest(manifestPath);
  if (!manifest) {
    return null;
  }
  return manifest.flows.map(f => f.id);
}

export async function checkClientManifestDrift(options: {
  discoveredFlows: Array<{
    id: string;
    routes?: readonly string[];
    actions?: readonly { id: string }[];
  }>;
  manifestPath: string;
}): Promise<ManifestDriftResult> {
  const { discoveredFlows, manifestPath } = options;

  if (discoveredFlows.length === 0) {
    return { isStale: false };
  }

  const manifest = await readClientManifest(manifestPath);
  if (manifest === null) {
    return { isStale: true, reason: "client manifest file is missing or unreadable" };
  }

  const discoveredFlowIds = new Set(discoveredFlows.map((flow) => flow.id));
  const manifestFlowIdSet = new Set(manifest.flows.map(f => f.id));

  const details: string[] = [];

  // Check for missing flows
  for (const flowId of discoveredFlowIds) {
    if (!manifestFlowIdSet.has(flowId)) {
      return { isStale: true, reason: `flow "${flowId}" is missing from manifest` };
    }
  }

  // Check for stale flows
  for (const flowId of manifestFlowIdSet) {
    if (!discoveredFlowIds.has(flowId)) {
      return { isStale: true, reason: `stale flow "${flowId}" in manifest` };
    }
  }

  // Deep comparison: routes, screens, actions
  for (const discoveredFlow of discoveredFlows) {
    const manifestFlow = manifest.flows.find(f => f.id === discoveredFlow.id);
    if (!manifestFlow) continue; // Already checked above

    // Use discovered flow as source of truth for whether to compare Mini App routes/actions
    const discoveredRoutes = new Set(discoveredFlow.routes ?? []);
    const hasDiscoveredMiniApp = discoveredRoutes.size > 0;
    
    if (hasDiscoveredMiniApp) {
      // Compare routes against manifest (even if manifest is missing miniApp)
      const manifestRoutes = new Set(Object.keys(manifestFlow.miniApp?.routes ?? {}));
      
      for (const route of discoveredRoutes) {
        if (!manifestRoutes.has(route)) {
          details.push(`Flow "${discoveredFlow.id}": route "${route}" missing from manifest`);
        }
      }
      
      for (const route of manifestRoutes) {
        if (!discoveredRoutes.has(route)) {
          details.push(`Flow "${discoveredFlow.id}": stale route "${route}" in manifest`);
        }
      }

      // Compare actions for flows with Mini App screens
      const discoveredActions = new Set(discoveredFlow.actions?.map(a => a.id) ?? []);
      const manifestActions = new Set(
        manifestFlow.screens.flatMap(s => s.actions ?? [])
      );

      for (const actionId of discoveredActions) {
        if (!manifestActions.has(actionId)) {
          details.push(`Flow "${discoveredFlow.id}": action "${actionId}" missing from manifest`);
        }
      }

      for (const actionId of manifestActions) {
        if (!discoveredActions.has(actionId)) {
          details.push(`Flow "${discoveredFlow.id}": stale action "${actionId}" in manifest`);
        }
      }
    }
  }

  // Check for contracts.ts presence
  const contractsPath = path.join(
    path.dirname(manifestPath),
    "contracts.ts"
  );
  
  try {
    await stat(contractsPath);
  } catch {
    return { 
      isStale: true, 
      reason: "contracts.ts file is missing alongside client manifest",
      details
    };
  }

  if (details.length > 0) {
    return {
      isStale: true,
      reason: "generated artifacts are out of sync with discovered flows",
      details
    };
  }

  return { isStale: false };
}
