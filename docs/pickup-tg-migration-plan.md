# pickup_tg → Teleforge V2 Migration Plan

## Current State

pickup_tg is a delivery logistics MVP built on Teleforge V1 (manifest-first, package-first). It implements:

- **Order creation** — sender creates orders via Mini App, bot confirms in chat
- **Driver assignment** — logistics backend assigns drivers, notifies via bot
- **Acceptance flow** — driver accepts/rejects orders via Mini App
- **Tracking** — real-time order tracking with Mini App → chat handoff
- **Notifications** — webhook-driven event bus with deduplication

**77 passing tests** across bot flows, mock API, WebSocket events, and Mini App components.

### Architecture

```
apps/bot      — Bot runtime, command handlers, web_app_data payload router
apps/web      — Mini App SPA (manual routing, no React Router)
apps/api      — Placeholder BFF (health + webhook stubs, unused)
apps/mock-api — Full Express + SQLite + WebSocket backend (outside Teleforge)
```

### V1 Patterns in Use

| Area         | Current Pattern                                                     |
| ------------ | ------------------------------------------------------------------- |
| Config       | `teleforge.app.json` — manifest-first with routes, commands, guards |
| Bot commands | `runtime.registerCommands([...])` — manual registration             |
| Web App data | Payload-type router in `webAppData.ts` — `switch (payload.type)`    |
| Web routing  | `window.history.pushState` + `useState` — no framework router       |
| Coordination | Deep-link `startapp` params (`track_<id>`, `job_<id>`)              |
| Storage      | In-memory `Map` — no persistence, no state machine                  |
| Role system  | Custom `RoleContext` + `RouteGuard` — app-level                     |
| Handoff      | `Telegram.WebApp.sendData()` with JSON payloads                     |
| Webhooks     | Custom Express server on port 3010 — outside framework              |

---

## V2 Target Architecture

This plan uses the current flow-first framework where it exists today and calls out future runtime concepts separately. Do not treat `FlowInstance` or repository-level APIs as available implementation primitives unless the framework has landed them.

### What Changes

| Area         | V1                                         | V2                                                                                     |
| ------------ | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| Config       | `teleforge.app.json` manifest              | `teleforge.config.ts` — code-first                                                     |
| Bot runtime  | `createBotRuntime()` + manual registration | `createDiscoveredBotRuntime()` — convention-based                                      |
| Flows        | Payload-type routing in handlers           | `defineFlow()` with steps, `onSubmit`, state machine                                   |
| Screens      | Manual `resolveRoute()` in `App.tsx`       | `defineScreen()` registry                                                              |
| Storage      | In-memory `Map`                            | Current: `UserFlowStateManager` state-key storage; future: instance repository runtime |
| Handoff      | `sendData()` JSON                          | Structured chat handoff via server bridge                                              |
| Coordination | Manual deep-link parsing                   | Signed flow context URLs with `tgWebAppStartParam`                                     |

### What Stays

| Area                | Reason                                                              |
| ------------------- | ------------------------------------------------------------------- |
| Mock API backend    | External service, not a Teleforge concern                           |
| WebSocket hooks     | App-level real-time, framework-agnostic                             |
| Role-based access   | App-specific business logic, survives as screen guards              |
| Web hooks           | `useLaunch`, `useTelegram`, `useMainButton`, etc. still exist in V2 |
| Test infrastructure | `node:test` + mocks — same test runner, updated assertions          |

---

## Migration Phases

### Phase 0: Preparation

**Goal:** Understand the gap, set up the migration branch, verify V2 framework builds.

- [ ] Create `migrate/v2` branch from `pickup_tg` main
- [ ] Link V2 teleforge packages (`link:../tmf/packages/*`)
- [ ] Document all 5 flows with step diagrams (current → target)
- [ ] Identify shared types to extract from `mock-api` → `packages/types`
- [ ] Remove duplicate interface definitions in `notification.ts`

**Deliverable:** Flow diagrams, shared types package, clean lint.

---

### Phase 1: Config and Bot Bootstrap

**Goal:** Replace manifest with `teleforge.config.ts`, switch to discovered bot runtime.

- [ ] Create `teleforge.config.ts` replacing `teleforge.app.json`
  - App identity, flow discovery root, bot config, Mini App entry
- [ ] Replace `createBotRuntime()` → `createDiscoveredBotRuntime()`
  - Remove `runtime.registerCommands()` — flows declare their own commands
  - Remove `runtime.router.onWebAppData()` — flows handle their own submits
- [ ] Update `apps/bot/src/index.ts` to match V2 pattern
  - `createDiscoveredBotRuntime({ cwd, flowSecret, miniAppUrl })`
  - `runtime.bindBot(bot)`, `runtime.getCommands()`, `runtime.handle(update)`
- [ ] Update `apps/bot/src/runtime.ts` exports
  - `createDevBotRuntime()` wrapper for dev tooling
- [ ] Delete `teleforge.app.json`

**Risk:** Low. Mechanical changes, well-defined V2 pattern from Task Shop.

---

### Phase 2: Flow Definitions

**Goal:** Convert all 5 payload-type routers into `defineFlow()` modules.

This is the largest phase. Each flow needs:

- Flow ID, initial step, final step, initial state
- Step definitions with `type`, `screen`, `onSubmit`, `onEnter`
- `bot.command` for chat entry (where applicable)
- `miniApp.route` and `miniApp.stepRoutes` for URL mapping

#### Flow 2A: Create Order

**Current:** `createOrderFlow.ts` — sender fills form, submits via `sendData()`, bot creates order.

**Target:**

```ts
defineFlow({
  id: "create-order",
  initialStep: "form",
  finalStep: "confirmed",
  state: { orderId: null, items: [], address: null },
  bot: { command: { command: "order", ... } },
  miniApp: { route: "/order", stepRoutes: { review: "/order/review" } },
  steps: {
    form: { screen: "order.form", type: "miniapp" },
    review: { screen: "order.review", type: "miniapp" },
    confirmed: { type: "chat", message: ({ state }) => `Order ${state.orderId} created` }
  }
})
```

- [ ] Define flow structure
- [ ] Convert `CreateOrder.tsx` → `order.form` + `order.review` screens
- [ ] Replace `sendData()` → `submit()` from screen props
- [ ] Add `onSubmit` handler that calls profile API to create order

#### Flow 2B: Accept Order

**Current:** `acceptOrderFlow.ts` — driver receives notification, opens Mini App, accepts/rejects.

**Target:**

```ts
defineFlow({
  id: "accept-order",
  initialStep: "details",
  finalStep: "decision",
  state: { orderId: null, accepted: null },
  miniApp: { route: "/accept" },
  steps: {
    details: { screen: "accept.details", type: "miniapp" },
    decision: { type: "chat", message: ({ state }) => (state.accepted ? "Accepted" : "Declined") }
  }
});
```

- [ ] Define flow structure
- [ ] Convert accept order pages → screens
- [ ] Replace payload routing → `onSubmit` handler
- [ ] Chat handoff on accept/decline decision

#### Flow 2C: Cancel Order

**Current:** `cancelOrderFlow.ts` — sender cancels, bot notifies driver.

**Target:** Similar pattern to accept order — details screen → confirmation chat step.

- [ ] Define flow structure
- [ ] Convert cancel flow → screens
- [ ] Wire cancellation API call in `onSubmit`

#### Flow 2D: Track Order

**Current:** `trackFlow.ts` — deep link `track_<orderId>`, Mini App shows status timeline.

**Target:**

```ts
defineFlow({
  id: "track-order",
  initialStep: "timeline",
  finalStep: "completed",
  state: { orderId: null },
  miniApp: { route: "/track" },
  steps: {
    timeline: { screen: "track.timeline", type: "miniapp" },
    completed: { type: "chat", message: "Tracking session ended" }
  }
});
```

- [ ] Define flow structure
- [ ] Convert track pages → screens
- [ ] Replace deep-link parsing → launch payload merge (`orderId` from URL)

#### Flow 2E: Driver Job

**Current:** `driverFlow.ts` — driver sees assigned jobs, accepts, updates status.

**Target:**

```ts
defineFlow({
  id: "driver-job",
  initialStep: "jobs",
  finalStep: "completed",
  state: { jobId: null, status: "pending" },
  miniApp: { route: "/driver" },
  steps: {
    jobs: { screen: "driver.jobs", type: "miniapp" },
    active: { screen: "driver.active", type: "miniapp" },
    completed: { type: "chat", message: "Job complete" }
  }
});
```

- [ ] Define flow structure
- [ ] Convert driver pages → screens
- [ ] Wire job status updates in `onSubmit`

**Risk:** High. Each flow has business logic, API calls, and error handling that must be preserved. The `onSubmit` handler replaces the entire payload-type routing layer.

---

### Phase 3: Screen Registry

**Goal:** Replace manual routing with `defineScreen()` registrations.

- [ ] Convert `App.tsx` → `TeleforgeMiniApp` shell
  - Remove `resolveRoute()`, `resolveDeepLink()`, manual `pushState`
  - Register all screens in `main.tsx`
- [ ] Convert each page to a screen:
  - `pages/Home.tsx` → `screens/home.screen.tsx`
  - `pages/CreateOrder.tsx` → `screens/order.form.screen.tsx` + `order.review.screen.tsx`
  - `pages/Track.tsx` → `screens/track.timeline.screen.tsx`
  - `pages/Driver.tsx` → `screens/driver.jobs.screen.tsx` + `driver.active.screen.tsx`
  - `pages/Jobs.tsx` → merge into driver flow screens
  - `pages/History.tsx` → `screens/history.screen.tsx`
  - `pages/Settings.tsx` → `screens/settings.screen.tsx`
  - `pages/Onboard.tsx` → `screens/onboard.screen.tsx`
- [ ] Replace `RouteGuard` → screen-level `guard` functions
- [ ] Replace `RoleContext` → flow-level guards or server-side guard hooks
- [ ] Wire `createFetchMiniAppServerBridge()` for chat handoff

**Risk:** Medium. Mechanical conversion but many files. Role-based guards need careful testing.

---

### Phase 4: Storage and Persistence

**Goal:** Replace ad hoc in-memory maps with the current Teleforge storage surface, while keeping future instance-repository work separate.

- [ ] Wire `UserFlowStateManager` into bot runtime where flow-state persistence is needed
  - `createDiscoveredBotRuntime({ storage: ... })`
- [ ] Migrate `OrderHistoryStore` → flow state or separate repository
  - Order history is cross-flow (multiple orders per user) → keep as repository, not flow state
  - Per-order tracking state → move into current flow state for the relevant flow
- [ ] Migrate `WebhookDedupStore` → persistent storage or framework-level dedup
- [ ] Preserve `chatId`, user id, and state key through current signed flow-context and handoff payloads
- [ ] Test crash recovery: restart bot, verify flow state persists

**Future runtime note:** [Flow State Architecture](./flow-state-design.md) describes a future `FlowInstanceRepository` and transition log model. Do not block the pickup_tg migration on that future repository layer unless the framework lands it first.

**Risk:** Medium. Order history is NOT flow-scoped (it's a user-level aggregate), so it should stay as a separate repository. Only per-flow execution state should move into Teleforge flow state.

---

### Phase 5: Server Hooks

**Goal:** Wire up server-side guards, loaders, and chat handoff.

- [ ] Convert `apps/api` from placeholder routes to hooks server
  - use `createDiscoveredServerHooksHandler()` from `teleforge/server-hooks`
  - pass supported trust/storage options through the current handler API
- [ ] Add server-side guards for role-based access
  - Fetch user role from profile API
  - Block screens for unauthorized roles
- [ ] Add server-side loaders for order data
  - Pre-fetch order details before screen render
- [ ] Wire chat handoff through the current structured Mini App handoff and discovered bot runtime path
- [ ] Remove custom webhook server if framework provides equivalent (or keep it separate)

**Risk:** Medium. The custom webhook server on port 3010 handles logistics events — this is outside Teleforge's scope and should stay separate.

---

### Phase 6: Tests

**Goal:** Update all 77 tests for V2 APIs.

- [ ] Bot flow tests — update for `defineFlow` assertions
- [ ] Screen tests — replace page render tests with screen render tests
- [ ] Chat/Mini App coordination tests — update for signed flow context URLs
- [ ] WebSocket tests — unchanged (app-level)
- [ ] Mock API tests — unchanged (external service)
- [ ] Add V2-specific tests:
  - current flow-state persistence and resume
  - Chat handoff round-trip
  - Duplicate submit dedup
  - Crash recovery

**Risk:** Medium. Test count may increase. Mock API and WebSocket tests are unaffected.

---

## Risk Assessment

| Risk                                               | Likelihood | Impact | Mitigation                                                            |
| -------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------- |
| Flow definitions don't capture complex order logic | Medium     | High   | Keep complex API calls in `onSubmit` handlers, not in flow definition |
| Role-based guards are harder in V2                 | Low        | Medium | Use server-side guard hooks that fetch role from profile API          |
| Order history doesn't fit flow state               | Low        | High   | Keep as separate repository — it's cross-flow, not per-flow state     |
| WebSocket hooks conflict with V2 coordination      | Low        | Medium | WebSocket is app-level, framework doesn't touch it                    |
| Cross-package imports from mock-api                | Medium     | Low    | Extract shared types to `packages/types`                              |

---

## What NOT to Migrate

| Component                         | Reason                                         |
| --------------------------------- | ---------------------------------------------- |
| `apps/mock-api`                   | External backend, not a Teleforge concern      |
| Custom webhook server (port 3010) | Logistics events, outside framework scope      |
| WebSocket event bus               | App-level real-time, framework-agnostic        |
| `apps/api` placeholder routes     | Replace with hooks server, don't migrate stubs |
| Manual deep-link parsing          | Replaced by signed flow context URLs           |
| `RoleContext` + `RouteGuard`      | Replaced by framework guards                   |

---

## Effort Estimate

| Phase                                 | Effort         |
| ------------------------------------- | -------------- |
| Phase 0: Preparation                  | 1-2 days       |
| Phase 1: Config and Bot Bootstrap     | 1 day          |
| Phase 2: Flow Definitions (5 flows)   | 5-7 days       |
| Phase 3: Screen Registry (8+ screens) | 3-4 days       |
| Phase 4: Storage and Persistence      | 2-3 days       |
| Phase 5: Server Hooks                 | 2-3 days       |
| Phase 6: Tests                        | 3-4 days       |
| **Total**                             | **17-24 days** |

This assumes one developer familiar with both V1 and V2 patterns. A less familiar developer should add 30-50% buffer.
