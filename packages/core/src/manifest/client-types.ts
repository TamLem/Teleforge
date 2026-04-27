export interface ClientFlowManifestEntry {
  id: string;
  miniApp?: {
    routes: Record<string, string>;
    defaultRoute?: string;
    title?: string;
  };
  screens: readonly ClientScreenManifestEntry[];
}

export interface ClientScreenManifestEntry {
  id: string;
  route?: string;
  title?: string;
  actions?: readonly string[];
  requiresSession?: boolean;
}

export interface ClientFlowManifest {
  flows: readonly ClientFlowManifestEntry[];
}
