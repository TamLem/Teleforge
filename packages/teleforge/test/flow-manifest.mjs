import assert from "node:assert/strict";
import test from "node:test";

import {
  createClientFlowManifest,
  defineClientFlowManifest,
  defineFlow,
  resolveMiniAppScreen
} from "../dist/index.js";

test("defineClientFlowManifest creates screen-resolvable client flow metadata", () => {
  const manifest = defineClientFlowManifest([
    {
      finalStep: "catalog",
      id: "shop",
      initialStep: "catalog",
      miniApp: {
        route: "/"
      },
      state: {
        selected: null
      },
      steps: {
        catalog: {
          screen: "catalog",
          type: "miniapp"
        }
      }
    }
  ]);

  const resolution = resolveMiniAppScreen({
    flows: manifest,
    pathname: "/",
    screens: [
      {
        component() {
          return null;
        },
        id: "catalog"
      }
    ]
  });

  assert.equal("reason" in resolution, false);
  assert.equal(resolution.flowId, "shop");
  assert.equal(resolution.screenId, "catalog");
});

test("createClientFlowManifest strips server-only handlers from full flow modules", () => {
  const flow = defineFlow({
    finalStep: "done",
    id: "checkout",
    initialStep: "catalog",
    miniApp: {
      route: "/",
      stepRoutes: {
        done: "/done"
      }
    },
    state: {
      count: 0
    },
    steps: {
      catalog: {
        actions: [
          {
            handler: () => ({
              state: {
                count: 1
              },
              to: "done"
            }),
            label: "Continue",
            to: "done"
          }
        ],
        onSubmit: () => ({
          state: {
            count: 1
          },
          to: "done"
        }),
        screen: "catalog",
        type: "miniapp"
      },
      done: {
        message: () => "Done",
        onEnter: () => undefined,
        type: "chat"
      }
    }
  });

  const [clientFlow] = createClientFlowManifest([flow]);
  const catalogStep = clientFlow.steps.catalog;
  const doneStep = clientFlow.steps.done;

  assert.equal(catalogStep.type, "miniapp");
  assert.equal(typeof catalogStep.onSubmit, "undefined");
  assert.equal(typeof catalogStep.actions[0].handler, "undefined");
  assert.deepEqual(catalogStep.actions[0], {
    id: "continue",
    label: "Continue",
    to: "done"
  });

  assert.equal(doneStep.type, "chat");
  assert.equal(doneStep.message, "");
  assert.equal(typeof doneStep.onEnter, "undefined");
});
