# Flow-First Execution Handoff Plan

This document is the takeover plan for the remaining V2 flow-first implementation work after commit `88597a8` (`Add Mini App continuity and flow server hooks`).

It is written for another execution agent picking up the repo mid-migration. It assumes the reader already understands the direction in:

- [Flow-First Developer Experience](./flow-first-dx.md)
- [Flow-First V2 Migration Plan](./flow-first-migration.md)

## Baseline

Start from:

- commit `88597a8`

Verified at that checkpoint:

- `npx --yes pnpm@10.15.0 --filter teleforge test`
- `npx --yes pnpm@10.15.0 lint`
- `npx --yes pnpm@10.15.0 docs:build`

Known repo state at that checkpoint:

- `teleforge` package tests pass
- docs build passes
- `@teleforgex/devtools` manifest coverage for the new flow/server-hook work passes
- one older devtools simulator test still flakes independently:
  - `packages/devtools/test/dev.mjs`
  - `dev logs upstream app 500 responses for simulator app requests`

Treat that simulator timeout as pre-existing until proven otherwise. Do not let it block the remaining framework migration work unless the failure becomes reproducible and clearly related to new changes.

## Current Framework State

Implemented already:

- unified `teleforge` package
- `teleforge.config.ts`
- discovered bot runtime
- discovered screen runtime
- framework-owned Mini App shell
- Mini App state snapshot persistence
- Mini App-to-chat handoff via `web_app_data`
- convention-based flow handlers
- convention-based flow server hooks
- Mini App fetch bridge plus discovered server-hook request handler
- devtools flow/screen/server-hook diagnostics

Still incomplete at the framework level:

- trusted auth/ownership enforcement in the server-hook bridge path
- richer return-to-chat and resume visibility in devtools
- migration of a complex real app onto the new runtime
- main docs cutover away from V1/package-first guidance

## Execution Order

Do the remaining work in this order:

1. Trusted server-hook bridge enforcement
2. Devtools visibility for return-to-chat and resume state
3. Complex example migration, preferably `apps/task-shop`
4. Main docs cutover and cleanup

This order matters. The complex example should land on the real trusted runtime path, not on a temporary bridge without ownership checks.

## Workstream 1: Trusted Server-Hook Bridge Enforcement

Goal:

- make server-backed flow hooks trustworthy for real apps, not just structurally available

Why this is next:

- the bridge now executes server hooks, but it does not yet enforce identity, flow ownership, or step validity in a way that should be treated as production-ready for multi-user flows

Primary files to inspect:

- [packages/teleforge/src/server-hooks.ts](/home/aj/hustle/tmf/packages/teleforge/src/server-hooks.ts)
- [packages/teleforge/src/miniapp-runtime.tsx](/home/aj/hustle/tmf/packages/teleforge/src/miniapp-runtime.tsx)
- [packages/teleforge/src/bot-runtime.ts](/home/aj/hustle/tmf/packages/teleforge/src/bot-runtime.ts)
- [packages/core/src/coordination/](/home/aj/hustle/tmf/packages/core/src/coordination)
- [packages/bff/src/context/create.ts](/home/aj/hustle/tmf/packages/bff/src/context/create.ts)
- [packages/bff/src/identity/](/home/aj/hustle/tmf/packages/bff/src/identity)
- [packages/bff/src/session/](/home/aj/hustle/tmf/packages/bff/src/session)

Implementation targets:

- define a trusted server-hook request context that can carry:
  - Telegram init/auth state
  - request identity
  - flow id
  - step id
  - optional flow instance key / state key
  - optional chat/user ownership context
- validate that the current user is allowed to execute the targeted flow step
- reject mismatched or stale flow instance state when the request is authoritative
- reject unknown step transitions before hook execution
- make it possible for server hooks to opt into trusted context without importing `@teleforgex/bff` as the public authoring model

Constraints:

- do not reintroduce `BFF` as a V2 public concept
- keep the public surface framed as optional server hooks
- do not move browser-only code into server modules or vice versa

Suggested output shape:

- keep `createFetchMiniAppServerBridge()` on the public web path
- keep `createDiscoveredServerHooksHandler()` as the server-side execution entrypoint
- add a context/options layer rather than a second parallel handler API

Tests to add:

- server-hook request rejected for unknown flow id
- server-hook request rejected for invalid step id
- server-hook request rejected for mismatched ownership/auth state
- server-hook request accepted for valid trusted flow execution
- Mini App runtime handles trusted server rejection as blocked/runtime error without corrupting local state

Verification:

- `npx --yes pnpm@10.15.0 --filter teleforge test`
- targeted `@teleforgex/bff` tests if any shared validation code is reused
- `npx --yes pnpm@10.15.0 lint`

## Workstream 2: Devtools Return-To-Chat And Resume Visibility

Goal:

- let `teleforge dev` show cross-surface continuity state, not just static flow wiring

Why this matters:

- the framework can now persist Mini App state and hand control back to chat, but devtools does not explain that lifecycle clearly enough yet

Primary files to inspect:

- [packages/devtools/src/utils/dev-simulator.ts](/home/aj/hustle/tmf/packages/devtools/src/utils/dev-simulator.ts)
- [packages/devtools/src/utils/manifest.ts](/home/aj/hustle/tmf/packages/devtools/src/utils/manifest.ts)
- [packages/devtools/test/dev.mjs](/home/aj/hustle/tmf/packages/devtools/test/dev.mjs)
- [packages/devtools/test/manifest.mjs](/home/aj/hustle/tmf/packages/devtools/test/manifest.mjs)
- [packages/teleforge/src/bot-runtime.ts](/home/aj/hustle/tmf/packages/teleforge/src/bot-runtime.ts)
- [packages/teleforge/src/miniapp-runtime.tsx](/home/aj/hustle/tmf/packages/teleforge/src/miniapp-runtime.tsx)

Implementation targets:

- show when a flow currently has:
  - persisted Mini App snapshot state
  - pending chat handoff
  - a resumed chat step after `web_app_data`
- surface the current route/step/stateKey relationship in simulator diagnostics
- add replay support for the structured handoff path if it is not already visible enough
- make the devtools UI explain whether a flow returned to chat locally, via explicit handoff state, or via real Telegram handoff

Tests to add:

- manifest-level summaries remain stable
- simulator state endpoint includes handoff/resume details
- replay of a handoff payload returns the flow to the correct chat step

Verification:

- `npx --yes pnpm@10.15.0 --filter @teleforgex/devtools test`
- if the existing flaky simulator test still fails, document that explicitly and keep the new assertions isolated from it

## Workstream 3: Complex Example Migration

Goal:

- move one serious app onto the flow-first runtime end to end

Recommended target:

- `apps/task-shop`

Why Task Shop:

- it is the best current candidate for proving that V2 handles more than the starter path

Primary files to inspect:

- [apps/task-shop/](/home/aj/hustle/tmf/apps/task-shop)
- [docs/flow-coordination.md](/home/aj/hustle/tmf/docs/flow-coordination.md)
- [packages/create-teleforge-app/src/templates.ts](/home/aj/hustle/tmf/packages/create-teleforge-app/src/templates.ts)

Migration targets:

- replace hand-wired bot runtime glue with discovered flow runtime
- move Mini App screen ownership to `TeleforgeMiniApp`
- move server-backed flow logic to convention-based server hooks where needed
- prove guarded screens, trusted submit/action paths, and real resume behavior
- reduce or remove app-local coordination glue that duplicates framework behavior

Recommended sub-order:

1. Port one non-trivial Task Shop flow first
2. Convert its screens
3. Convert any trusted server logic
4. Only then remove the old wiring for that flow

Do not attempt a one-shot full app rewrite unless the current code proves unusually shallow.

Verification:

- app-specific build/tests
- `npx --yes pnpm@10.15.0 lint`
- targeted simulator/manual dev checks if the example has complicated resume paths

## Workstream 4: Main Docs Cutover

Goal:

- make the public docs describe the actual V2 framework model first

Primary docs to rewrite:

- [docs/getting-started.md](/home/aj/hustle/tmf/docs/getting-started.md)
- [docs/developer-guide.md](/home/aj/hustle/tmf/docs/developer-guide.md)
- [docs/architecture.md](/home/aj/hustle/tmf/docs/architecture.md)
- [docs/testing.md](/home/aj/hustle/tmf/docs/testing.md)

Docs constraints:

- flows, screens, handlers, and optional server hooks should appear before package topology
- `BFF` should remain an implementation detail or migration term, not a primary app concept
- do not describe SPA vs Next.js style mode choices as the V2 story

Verification:

- `npx --yes pnpm@10.15.0 docs:build`

## Invariants To Preserve

Keep these true while doing the remaining work:

- `teleforge.config.ts` remains the primary app definition
- flow-owned routes are derived from flow conventions, not duplicated in config
- the public story stays `flows + screens + optional server hooks`
- the browser-facing `teleforge/web` surface remains browser-safe
- devtools keeps one unified flow-completeness model instead of separate diagnostics systems per runtime layer

## Recommended Agent Workflow

If another execution agent takes over, the safest cadence is:

1. start from `88597a8`
2. complete one workstream at a time
3. verify package-local tests first
4. update [docs/flow-first-migration.md](/home/aj/hustle/tmf/docs/flow-first-migration.md) and [docs/flow-first-dx.md](/home/aj/hustle/tmf/docs/flow-first-dx.md) after each real framework slice
5. keep commits narrow and slice-shaped

Good commit boundaries:

- trusted server-hook enforcement
- devtools handoff/resume visibility
- Task Shop flow migration
- docs cutover

## Definition Of Done

The remaining migration work is done when:

- trusted server-hook execution enforces identity and ownership where needed
- devtools can explain handoff and resume state clearly
- a complex example runs through the new flow-first runtime without app-local duplication
- the main docs teach the flow-first runtime as the default Teleforge model
