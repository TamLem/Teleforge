# Task: Rebuild `../pickup_tg` On The Current Teleforge Scaffold

## Objective

Rebuild the sibling `../pickup_tg` app on the current Teleforge model using a fresh scaffold as the starting point.

The target app should use:

- `teleforge.config.ts` as the app definition
- the unified `teleforge` package and public subpaths only
- discovered `defineFlow()` modules for bot and Mini App journeys
- `defineScreen()` modules for Mini App screens
- optional server hooks for trusted backend execution
- the current `teleforge dev` simulator-first workflow

Do not retrofit the old workspace in place as the first step. Generate a new scaffold, port product behavior into it slice by slice, and use the existing app only as the behavioral reference.

## Source App Summary

Existing sibling app:

- path: `../pickup_tg`
- surfaces:
  - `apps/bot`: sender and driver chat flows, notification delivery, order history, cancellation, polling runtime, simulator bridge
  - `apps/web`: Vite Mini App with sender tracking, driver views, profile/onboarding/settings/history pages, WebSocket hooks, route guards
  - `apps/mock-api`: local logistics provider simulation, in-memory data, events, notifications, WebSocket updates
  - `apps/api`: placeholder API/webhook routes
- important product behaviors:
  - sender onboarding and order creation
  - sender order history and cancellation
  - driver onboarding, job discovery, acceptance, and status updates
  - tracking links and live order updates
  - notification fanout from provider events back to chat
  - resilience behavior around retries, timeouts, circuit breaking, and duplicate webhook handling

## Target Workspace Shape

Create a new scaffolded app first:

```bash
cd /home/aj/hustle
node tmf/packages/create-teleforge-app/dist/cli.js pickup_tg_next --link /home/aj/hustle/tmf
cd pickup_tg_next
pnpm install
pnpm run dev
```

If the generator has not been built:

```bash
cd /home/aj/hustle/tmf
pnpm --filter create-teleforge-app build
```

Expected target layout:

```text
pickup_tg_next/
  teleforge.config.ts
  apps/bot/
    src/flows/
    src/runtime.ts
    src/index.ts
  apps/web/
    src/screens/
    src/main.tsx
  apps/api/
    src/
  packages/types/        # scaffolded shared domain contracts
```

Keep `apps/mock-api` as either:

- a carried-over local provider app inside the new workspace, or
- a separate local dev service referenced by env vars.

Prefer carrying it into the new workspace during the migration so tests and local workflows stay self-contained.

## Non-Goals

- Do not preserve old package imports.
- Do not preserve the old app-config format.
- Do not keep page-router wiring as the product model.
- Do not rewrite the logistics provider domain from scratch unless necessary.
- Do not add production persistence or real provider integration unless credentials and contracts are available.

## Migration Slices

### Slice 1. Create The Fresh Scaffold

Tasks:

- generate `pickup_tg_next` from the current scaffold
- install dependencies
- run the scaffold dev workflow once
- confirm the generated app imports only from public `teleforge` surfaces
- commit the untouched scaffold as the baseline if working in the sibling repo

Acceptance criteria:

- `pnpm install` succeeds
- `pnpm run dev` starts the simulator workflow
- `pnpm run doctor` reports the expected local status
- no app source imports internal framework packages

Verification:

```bash
pnpm run doctor
pnpm run build
pnpm run test
```

### Slice 2. Port Shared Domain Types

Tasks:

- replace the scaffolded starter type with stable domain types from the old app:
  - order
  - driver
  - sender profile
  - address/location
  - order status
  - event payloads
- keep type package free of React, Telegram, and runtime dependencies

Acceptance criteria:

- bot, web, API, and mock API can import the same domain contracts
- no domain type depends on a transport-specific shape
- type package builds independently

Verification:

```bash
pnpm --filter @pickup-tg/types build
pnpm run build
```

### Slice 3. Port The Mock Logistics Provider

Tasks:

- copy the existing mock provider into the new workspace
- preserve:
  - order service behavior
  - assignment service behavior
  - event bus
  - event logger
  - profile routes
  - WebSocket update service
- update package names and workspace references
- ensure the mock provider reads config from the new `.env` shape

Acceptance criteria:

- mock API starts in the new workspace
- existing mock API tests are ported and passing
- provider routes remain compatible with bot/web clients

Verification:

```bash
pnpm --filter @pickup-tg/mock-api test
pnpm --filter @pickup-tg/mock-api build
```

### Slice 4. Model Sender Chat Journeys As Flows

Tasks:

- create sender flow modules under `apps/bot/src/flows`
- convert command/handler behavior into `defineFlow()` steps:
  - start/onboarding
  - create order
  - order history
  - cancel order
  - open tracking Mini App
- use chat steps for conversational actions
- use Mini App steps for richer tracking or order UI
- keep provider calls behind services or server hooks where authority is needed

Acceptance criteria:

- sender can start from chat
- sender can create an order through the intended chat/Mini App path
- sender can view history and cancel orders
- bot runtime is discovered by the current Teleforge runtime

Verification:

```bash
pnpm --filter @pickup-tg/bot test
pnpm run dev
```

Manual simulator checks:

- `/start`
- create order path
- history path
- cancel path
- open tracking Mini App button

### Slice 5. Model Driver Chat Journeys As Flows

Tasks:

- create driver flow modules under `apps/bot/src/flows`
- convert existing driver behavior into steps:
  - driver onboarding
  - available jobs
  - accept job
  - update status
  - open driver Mini App screen
- preserve provider and notification behavior

Acceptance criteria:

- driver can discover jobs from chat
- driver can accept a job
- driver can update status
- sender notifications still fire through the event pipeline

Verification:

```bash
pnpm --filter @pickup-tg/bot test
pnpm --filter @pickup-tg/mock-api test
```

Manual simulator checks:

- driver onboarding
- jobs list
- accept job
- status update
- notification sent to sender chat context

### Slice 6. Convert Mini App Pages To Screens

Tasks:

- replace page-router mental model with screen modules under `apps/web/src/screens`
- convert existing pages to `defineScreen()` modules:
  - home
  - create order
  - track order
  - order history
  - driver jobs
  - driver active order
  - onboarding/profile
  - settings
- keep reusable components under `apps/web/src/components`
- keep local UI state inside components
- read authoritative flow state from Teleforge screen runtime props

Acceptance criteria:

- screens resolve by flow step and screen id
- no screen reconstructs durable flow state from query params alone
- standalone Mini App entry has a safe fallback screen
- current UI components are preserved unless they conflict with the new runtime contract

Verification:

```bash
pnpm --filter @pickup-tg/web build
pnpm --filter @pickup-tg/web test
```

Manual simulator checks:

- sender opens tracking screen from chat
- driver opens job screen from chat
- refresh/re-entry does not lose flow context

### Slice 7. Add Server Hooks For Trusted Work

Tasks:

- create server-hook modules for flow steps that need authority:
  - create order
  - cancel order
  - accept job
  - update delivery status
  - load tracking details
  - load driver job list
- move provider mutations out of browser code
- validate actor ownership and current step before mutating state
- keep mock provider calls behind services

Acceptance criteria:

- browser submit/action payloads are validated server-side
- server hooks own provider mutations
- flow state is committed only through Teleforge runtime transitions
- unauthorized actor/state-key combinations are rejected

Verification:

```bash
pnpm --filter @pickup-tg/api test
pnpm run test
```

Manual simulator checks:

- tampered order id is rejected
- wrong actor cannot accept/cancel another user's order
- valid submit transitions to the expected next step

### Slice 8. Reconnect Live Updates And Notifications

Tasks:

- port WebSocket hooks for sender tracking and driver status updates
- preserve event bus semantics in the mock provider
- reconnect notification consumer to the new bot runtime
- define where long-running consumers start in local dev and production
- avoid coupling Mini App screen state directly to transient socket messages

Acceptance criteria:

- sender tracking screen receives live status updates
- driver active-order screen receives live assignment/status updates
- chat notifications are emitted for important order events
- reconnect/reload behavior is safe

Verification:

```bash
pnpm --filter @pickup-tg/mock-api test
pnpm --filter @pickup-tg/web test
pnpm --filter @pickup-tg/bot test
```

### Slice 9. Port Tests And Audit Coverage

Tasks:

- port bot flow tests
- port web component/screen tests
- port mock API tests
- add integration tests for the current Teleforge model:
  - config loads
  - flows discover
  - screens discover
  - sender chat → Mini App → chat path
  - driver chat → Mini App path
  - server-hook rejection paths
- remove tests that assert old app shape rather than product behavior

Acceptance criteria:

- tests verify product behavior through current flow/screen runtime contracts
- no tests depend on removed config or package topology
- CI-safe tests do not require real Telegram credentials

Verification:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

### Slice 10. Cut Over README And Local Workflow

Tasks:

- rewrite the new app README around the current scaffold
- document:
  - simulator-first workflow
  - mock provider workflow
  - live Telegram workflow
  - environment variables
  - sender and driver verification checklist
- remove instructions tied to the old app shape

Acceptance criteria:

- a developer can start from the README and run the current app
- docs mention only the unified `teleforge` package
- docs explain the mock provider as a local service, not as framework architecture

Verification:

```bash
pnpm run dev
pnpm run dev:mock-api
pnpm run doctor
```

## Final Acceptance Criteria

The migration is complete when:

- `pickup_tg_next` runs from a fresh current scaffold
- app code imports only public `teleforge` surfaces
- all sender and driver journeys are represented as discovered flows
- all Mini App views are represented as registered screens
- trusted mutations run through server hooks or server-owned services
- mock logistics provider behavior is preserved
- local simulator workflow exercises bot + Mini App paths
- tests cover sender, driver, provider, and cross-surface flows
- old workspace can be archived or replaced by the new scaffolded workspace

## Recommended Execution Order

1. Scaffold and commit the blank current app.
2. Port shared types.
3. Port mock provider and tests.
4. Port sender bot flows.
5. Port driver bot flows.
6. Convert Mini App pages to screens.
7. Add server hooks for trusted mutations.
8. Reconnect live updates and notifications.
9. Port tests and add integration coverage.
10. Cut over README and developer workflow.

## Risks

- The old app mixes product behavior with routing and transport concerns. Expect to separate product logic from old route/page boundaries.
- Live update behavior may need a small runtime service boundary so socket events do not become authoritative flow state.
- Notification consumers need a clear process owner in local dev and production.
- Real provider integration should remain out of scope until sandbox credentials and API contracts are available.
