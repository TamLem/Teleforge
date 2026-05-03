interface DiscoveredFlowSummary {
  id: string;
  hasWiringGaps: boolean;
  steps: Array<{ id: string; status: string }>;
}

export interface MockWebApp {
  initData: string;
  initDataUnsafe: Record<string, unknown>;
  viewportHeight: number;
  viewportStableHeight: number;
  viewportWidth?: number;
  platform: string;
  version: string;
  colorScheme: string;
  themeParams: Record<string, unknown>;
  isExpanded: boolean;
  ready: () => void;
  expand: () => void;
  close: () => void;
  onEvent: (event: string, callback: () => void) => void;
  offEvent: (event: string, callback: () => void) => void;
  sendData: (data: string) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  showPopup: (params: Record<string, unknown>, callback?: (id?: string) => void) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
}

export async function validateDiscoveredWiring(
  cwd: string
): Promise<{ flows: number; steps: number }> {
  const devtools = (await import("@teleforge/devtools")) as unknown as {
    loadManifest: (cwd: string) => Promise<{ discoveredFlows: DiscoveredFlowSummary[] }>;
  };
  const { discoveredFlows } = await devtools.loadManifest(cwd);

  const gapFlows: string[] = [];
  const warningSteps: string[] = [];
  let totalSteps = 0;

  for (const flow of discoveredFlows) {
    if (flow.hasWiringGaps) {
      gapFlows.push(flow.id);
    }

    for (const step of flow.steps) {
      totalSteps++;
      if (step.status === "warning") {
        warningSteps.push(`${flow.id}/${step.id}`);
      }
    }
  }

  if (gapFlows.length > 0 || warningSteps.length > 0) {
    const details: string[] = [];
    if (gapFlows.length > 0) {
      details.push(`Flows with wiring gaps: ${gapFlows.join(", ")}`);
    }
    if (warningSteps.length > 0) {
      details.push(`Steps with warning status: ${warningSteps.join(", ")}`);
    }
    throw new Error(`Discovered wiring validation failed. ${details.join("; ")}`);
  }

  return { flows: discoveredFlows.length, steps: totalSteps };
}

export function createMockWebApp(overrides: Partial<MockWebApp> = {}): MockWebApp {
  const listeners = new Map<string, Set<() => void>>();

  const onEvent = (event: string, callback: () => void): void => {
    let set = listeners.get(event);
    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }
    set.add(callback);
  };

  const offEvent = (event: string, callback: () => void): void => {
    listeners.get(event)?.delete(callback);
  };

  const mock: MockWebApp = {
    initData: "",
    initDataUnsafe: {},
    viewportHeight: 600,
    viewportStableHeight: 600,
    viewportWidth: 400,
    platform: "web",
    version: "7.0",
    colorScheme: "light",
    themeParams: {},
    isExpanded: false,
    ready: () => {},
    expand: () => {},
    close: () => {},
    onEvent,
    offEvent,
    sendData: () => {},
    showAlert: () => {},
    showConfirm: () => {},
    showPopup: () => {},
    openLink: () => {},
    openTelegramLink: () => {},
    ...overrides
  };

  return mock;
}
