import type { DiscoveredFlowModule } from "./discovery.js";
import type { ActionFlowDefinition } from "./flow-definition.js";
import type { ClientFlowManifest, ClientFlowManifestEntry, ClientScreenManifestEntry } from "@teleforgex/core";

type AnyFlowDefinition = ActionFlowDefinition;

export type TeleforgeClientFlowManifest = ClientFlowManifest;

export function defineClientFlowManifest(
  manifest: ClientFlowManifest
): Readonly<ClientFlowManifest> {
  return Object.freeze({
    flows: Object.freeze(
      manifest.flows.map((entry) =>
        Object.freeze({
          ...entry,
          ...(entry.miniApp
            ? {
                miniApp: Object.freeze({
                  ...entry.miniApp,
                  routes: Object.freeze({ ...entry.miniApp.routes })
                })
              }
            : {}),
          screens: Object.freeze(
            entry.screens.map((screen) => Object.freeze({ ...screen }))
          )
        })
      )
    )
  });
}

export function createClientFlowManifest(
  flows: Iterable<ActionFlowDefinition | DiscoveredFlowModule>,
  screens?: Iterable<{ id: string; title?: string }>
): ClientFlowManifest {
  const screenMap = new Map<string, string>();
  if (screens) {
    for (const screen of screens) {
      if (screen.title) {
        screenMap.set(screen.id, screen.title);
      }
    }
  }

  return Object.freeze({
    flows: Object.freeze(
      Array.from(flows, (entry) => {
        const flow = "flow" in entry ? entry.flow : entry;
        return createManifestEntry(flow, screenMap);
      })
    )
  });
}

function createManifestEntry(
  flow: ActionFlowDefinition,
  screenTitles: Map<string, string>
): ClientFlowManifestEntry {
  const screens: ClientScreenManifestEntry[] = [];

  if (flow.miniApp?.routes) {
    const seen = new Set<string>();
    for (const [route, screenId] of Object.entries(flow.miniApp.routes)) {
      if (seen.has(screenId)) {
        continue;
      }
      seen.add(screenId);

      const screenActions = flow.actions
        ? Object.keys(flow.actions)
        : undefined;

      screens.push({
        actions: screenActions,
        id: screenId,
        requiresSession: flow.session?.enabled,
        route,
        title: screenTitles.get(screenId)
      });
    }
  }

  return {
    id: flow.id,
    ...(flow.miniApp
      ? {
          miniApp: {
            defaultRoute: flow.miniApp.defaultRoute,
            routes: { ...flow.miniApp.routes },
            title: flow.miniApp.title
          }
        }
      : {}),
    screens: Object.freeze(screens)
  };
}
