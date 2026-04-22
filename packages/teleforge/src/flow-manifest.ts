import { defineFlow, resolveFlowActionKey } from "./flow-definition.js";

import type { DiscoveredFlowModule } from "./discovery.js";
import type {
  ChatFlowStepDefinition,
  FlowActionDefinition,
  FlowStepDefinition,
  MiniAppFlowStepDefinition,
  TeleforgeFlowDefinition,
  TeleforgeFlowDefinitionInput
} from "./flow-definition.js";

type AnyFlowDefinition = TeleforgeFlowDefinition<unknown, unknown>;
type AnyFlowDefinitionInput = TeleforgeFlowDefinitionInput<unknown, unknown>;

export type TeleforgeClientFlowManifest = readonly AnyFlowDefinition[];

export function defineClientFlowManifest(
  flows: Iterable<AnyFlowDefinitionInput>
): TeleforgeClientFlowManifest {
  return Object.freeze(Array.from(flows, (flow) => defineFlow(flow)));
}

export function createClientFlowManifest(
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>
): TeleforgeClientFlowManifest {
  return Object.freeze(
    Array.from(flows, (entry) => stripFlowForClient("flow" in entry ? entry.flow : entry))
  );
}

function stripFlowForClient(flow: AnyFlowDefinition): AnyFlowDefinition {
  return defineFlow({
    ...(flow.bot ? { bot: flow.bot } : {}),
    finalStep: flow.finalStep,
    id: flow.id,
    initialStep: flow.initialStep,
    ...(flow.miniApp ? { miniApp: flow.miniApp } : {}),
    ...(flow.onComplete ? { onComplete: flow.onComplete } : {}),
    state: structuredClone(flow.state),
    steps: Object.fromEntries(
      Object.entries(flow.steps).map(([stepId, step]) => [stepId, stripStepForClient(step)])
    )
  });
}

function stripStepForClient(step: FlowStepDefinition<unknown, unknown>) {
  if (step.type === "chat") {
    return {
      ...(step.actions ? { actions: stripActionsForClient(step.actions) } : {}),
      message: typeof step.message === "string" ? step.message : "",
      ...(step.miniApp ? { miniApp: step.miniApp } : {}),
      type: "chat" as const
    } satisfies ChatFlowStepDefinition<unknown, unknown>;
  }

  return {
    ...(step.actions ? { actions: stripActionsForClient(step.actions) } : {}),
    screen: step.screen,
    type: "miniapp" as const
  } satisfies MiniAppFlowStepDefinition<unknown, unknown, unknown>;
}

function stripActionsForClient(
  actions: ReadonlyArray<FlowActionDefinition<unknown, unknown>>
): Array<FlowActionDefinition<unknown, unknown>> {
  return actions.map((action) => ({
    id: resolveFlowActionKey(action),
    label: action.label,
    ...(action.miniApp ? { miniApp: action.miniApp } : {}),
    ...(action.to ? { to: action.to } : {})
  }));
}
