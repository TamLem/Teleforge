import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

import {
  createFlowRuntimeSummaries,
  loadTeleforgeApp,
  loadTeleforgeFlows,
  loadTeleforgeScreens,
  resolveMiniAppScreen
} from "../../../../packages/teleforge/dist/index.js";

test("Task Shop loads its Teleforge app config and derives routes from flows", async () => {
  const workspaceRoot = resolveTaskShopWorkspaceRoot();
  const loaded = await loadTeleforgeApp(workspaceRoot);

  assert.equal(path.basename(loaded.appPath), "teleforge.config.ts");
  assert.equal(loaded.app.app.id, "task-shop");
  assert.deepEqual(
    loaded.app.routes?.map((route) => route.path).sort(),
    ["/", "/shop"]
  );
});

test("Task Shop discovery exposes both bot flows and all migrated Mini App screens", async () => {
  const workspaceRoot = resolveTaskShopWorkspaceRoot();
  const loaded = await loadTeleforgeApp(workspaceRoot);
  const flows = await loadTeleforgeFlows({
    app: loaded.app,
    cwd: workspaceRoot
  });
  const screens = await loadTeleforgeScreens({
    app: loaded.app,
    cwd: workspaceRoot
  });
  const summaries = createFlowRuntimeSummaries(flows);

  assert.deepEqual(
    flows.map((entry) => entry.flow.id).sort(),
    ["shop-catalogue", "task-shop-browse"]
  );
  assert.deepEqual(
    screens.map((entry) => entry.screen.id).sort(),
    ["shop.checkout", "shop.tracking", "task-shop.cart", "task-shop.catalog", "task-shop.checkout", "task-shop.detail", "task-shop.success"]
  );
  assert.equal(summaries.find((summary) => summary.id === "task-shop-browse")?.stepCount, 6);
});

test("Task Shop discovery resolves flow routes to the migrated screen ids", async () => {
  const workspaceRoot = resolveTaskShopWorkspaceRoot();
  const loaded = await loadTeleforgeApp(workspaceRoot);
  const flows = await loadTeleforgeFlows({
    app: loaded.app,
    cwd: workspaceRoot
  });
  const screens = await loadTeleforgeScreens({
    app: loaded.app,
    cwd: workspaceRoot
  });

  const cartResolution = resolveMiniAppScreen({
    flows,
    pathname: "/cart",
    screens
  });
  const successResolution = resolveMiniAppScreen({
    flows,
    pathname: "/success",
    screens
  });

  assert.ok(!("reason" in cartResolution));
  assert.ok(!("reason" in successResolution));
  assert.equal(cartResolution.screenId, "task-shop.cart");
  assert.equal(successResolution.screenId, "task-shop.success");
});

function resolveTaskShopWorkspaceRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
}
