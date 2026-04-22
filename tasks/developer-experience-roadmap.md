# Developer Experience Roadmap

Teleforge is moving toward a single framework package where developers define product behavior as:

```text
flow -> step -> screen -> transition
```

The current DX is functional and improving, but there are still places where app authors can see framework internals, duplicate metadata, or receive low-level diagnostics. This roadmap tracks the improvements needed to make Teleforge feel like one unified framework rather than separate bot, web, server, and tooling libraries.

## Goals

- Developers start from flows, screens, and handlers.
- App code imports from the public `teleforge` package surfaces only.
- The framework owns launch wiring, screen routing, manifest generation, and continuation.
- Errors are reported in flow, step, screen, and route terms.
- Generated apps are useful enough to extend directly.
- Local development exposes the active flow state and transition path clearly.
- The implementation is thin: one framework package, one flow-first mental model, and no legacy runtime modes.

## Current Strengths

- The public authoring surface is centered on `teleforge`, `teleforge/web`, `teleforge/bot`, and `teleforge/server-hooks`.
- The scaffold creates `apps/bot`, `apps/web`, `apps/api`, and `packages/types`.
- Flow definitions now describe chat steps, Mini App steps, bot commands, Mini App routes, and screen ids.
- `TeleforgeMiniApp` can use a client-safe `flowManifest`, so web code does not need to import bot flow modules.
- `teleforge dev` provides a simulator, embedded Mini App runtime, config validation, and companion bot process.
- The framework has regression coverage for direct Mini App routes without bot commands.

## Gaps

- App services, mock providers, and server hooks need stronger conventions in generated projects.
- The debug panel does not yet show enough flow runtime state for complex cross-surface debugging.
- Testing utilities are still mostly patterns instead of first-class framework helpers.
- The repository still contains internal package boundaries and legacy concepts that make Teleforge look like several libraries instead of one framework.

## Improvement Plan

### 1. Generate the Client Flow Manifest

Replace manually maintained `apps/web/src/flow-manifest.ts` with a framework-generated client-safe manifest.

Target shape:

```ts
import { flowManifest } from "teleforge/generated/client-flow-manifest";
```

The generated manifest should include only browser-safe metadata:

- flow id
- initial and final step ids
- route and step route mapping
- step type
- screen ids
- action labels, ids, targets, and Mini App payload metadata
- initial public state shape

It must not include:

- submit handlers
- action handlers
- loaders
- guards
- server services
- environment access
- Node-only dependencies

Keep handwritten manifests as an escape hatch until generated manifests are stable.

### 2. Improve Diagnostics

Replace raw validation messages with Teleforge-specific errors.

Examples:

- Instead of `Array must contain at least 1 element(s)`, report `Flow "driver" route "/driver" has no launch entrypoint. Add a bot command, direct Mini App entrypoint, or miniApp.entryPoints.`
- Instead of a generic missing screen error, report `Flow "checkout" step "address" references screen "checkout.address", but no matching screen was discovered under apps/web/src/screens.`

Every diagnostic should include the most specific context available:

- config file
- flow id
- step id
- screen id
- route path
- source file path

### 3. Expand Doctor Into Flow Validation

`teleforge doctor` should validate framework wiring, not only environment and manifest shape.

Checks should include:

- every Mini App step resolves to a registered screen
- every route resolves to a flow step
- every screen id is used or intentionally standalone
- every action either transitions or has a handler/server hook
- every server hook maps to a known flow step/action
- every client manifest entry matches discovered flow metadata
- every direct Mini App route has a valid launch entry point

Output should be grouped by flow:

```text
Flow: checkout
  Step: address
    Screen: checkout.address
    Route: /checkout/address
    Status: ready
```

### 4. Strengthen the Scaffold

Generated apps should include enough structure to scale without immediate reorganization.

Required scaffold shape:

- `apps/bot/src/flows`
- `apps/web/src/screens`
- `apps/api/src/flow-hooks`
- `packages/types`
- project-scoped package names
- root scripts for `dev`, `dev:public`, `doctor`, `lint`, `typecheck`, `test`, `build`, and `check`

The scaffold should also include one server-hook example so developers see the intended boundary for trusted work.

### 5. Add Flow Authoring Helpers

Raw object flow definitions should remain supported, but common patterns should have lower ceremony.

Candidate helpers:

```ts
miniAppStep("checkout.address")
chatStep("Order confirmed.", actions)
returnToChatAction()
openMiniAppAction({ label: "Checkout", to: "checkout" })
```

The goal is not to create a DSL that hides TypeScript. The goal is to make common flows easier to read and harder to misconfigure.

### 6. Define App Service Conventions

Teleforge should document and scaffold a clear place for application services.

Recommended convention:

- shared types in `packages/types`
- domain logic in `apps/api/src/services` or `packages/domain`
- trusted flow loaders/actions/submits in `apps/api/src/flow-hooks`
- UI-only logic in `apps/web/src/screens`

Flow and screen code should not import server-only implementation into the browser.

### 7. Support Companion Dev Services

`teleforge dev` should be able to start declared local services such as mock APIs, webhook sinks, or local workers.

Potential config:

```ts
dev: {
  services: [
    {
      name: "mock-api",
      command: "pnpm --filter @app/mock-api dev",
      health: "http://127.0.0.1:3001/health"
    }
  ]
}
```

The simulator should show service status and surface startup failures clearly.

### 8. Improve the Runtime Debug Panel

The debug panel should expose flow runtime state directly.

It should show:

- current flow id
- current step id
- current screen id
- route path
- state key
- current state snapshot
- latest transition
- latest submit/action payload
- server hook calls and results
- chat handoff status

This is important because Teleforge apps cross chat, Mini App, and server boundaries.

### 9. Formalize Testing Utilities

Provide first-class helpers for common app tests:

- render a screen with fake Teleforge runtime props
- execute a flow transition
- simulate bot command to Mini App launch
- simulate Mini App submit to chat handoff
- validate discovered flow/screen wiring

The scaffold should use these helpers so developers learn the testing model from generated code.

### 10. Complete Documentation Cutover

Permanent docs should stay focused on the current framework model:

- build a flow
- add a screen
- add server hooks
- run locally
- deploy
- test
- debug

Avoid migration-era language in primary docs. Historical migration details should live outside the main learning path.

### 11. Thin the Framework to Core Essentials

Teleforge should keep the runtime pieces that directly support the flow-first product model and remove or internalize everything else.

Core essentials:

- `teleforge`: flow definitions, config loading, discovery, screen registry, Mini App runtime, server hook bridge, and framework runtime types
- `teleforge/bot`: Telegram update handling, bot commands, flow start/resume, Mini App launch buttons, callback handling, and phone/contact helpers
- `teleforge/web`: Mini App shell/runtime hooks, Telegram SDK hooks, launch context, submit/action bridge, and screen runtime integration
- CLI: `teleforge dev`, `teleforge doctor`, scaffold generation, and production-oriented validation
- Shared internals: `initData` validation, manifest/config validation, flow storage, phone auth utilities, launch metadata, and trusted server hook helpers

Remove first:

- `packages/bff`, because server hooks are the public trusted-server model and BFF is no longer a product mode
- BFF references in docs, TypeDoc path aliases, changelogs, package metadata, and tests
- BFF-specific wording in web coordination, replacing it with server hook or runtime bridge terminology where the capability remains useful

Demote or internalize:

- `packages/ui`, because UI primitives are convenience components rather than core runtime; scaffolded apps should own their starter UI or import an optional UI kit later
- `packages/devtools`, because the CLI remains essential but `@teleforgex/devtools` does not need to be a public standalone package
- `@teleforgex/core`, `@teleforgex/bot`, and `@teleforgex/web` as published identities; source modules can stay temporarily, but the user-facing framework should be the single `teleforge` package

Prune after dependency checks:

- `packages/core/src/events/*` if it remains self-contained infrastructure with no runtime consumer
- old `packages/web/src/flow/*` and `packages/web/src/guards/*` APIs once `TeleforgeMiniApp` plus server hook guards cover the same flow-runtime path
- framework-owned Express/Fastify webhook adapters if a smaller fetch/node-neutral webhook handler is sufficient

Target package posture:

- one published framework package: `teleforge`
- one scaffold package: `create-teleforge-app`
- internal implementation modules may remain in the monorepo during refactor, but docs and generated apps should not teach `@teleforgex/*`
- no BFF mode, no legacy SPA/Next.js positioning, and no requirement for app authors to understand package-boundary internals

## Recommended Implementation Order

1. ~~Generated client flow manifest.~~ Completed. `teleforge generate client-manifest` discovers flows, strips server-only fields, and writes a browser-safe manifest. Scaffolded apps include `predev`/`prebuild`/`pretest` scripts that auto-regenerate the manifest. Real projects and generator tests pass reliably.
2. ~~Better diagnostics and doctor wiring checks.~~ Completed. `formatManifestValidationErrors()` replaces raw Zod messages with contextual guidance (flow id, step id, screen id, route path). `teleforge doctor` includes a `flow_wiring` check that validates screen resolution, action handlers, server hooks, and orphaned modules.
3. ~~Scaffold scripts and server-hook example.~~ Completed. Generated projects include root `lint`/`typecheck`/`build`/`check` scripts, per-package `typecheck` scripts, and an `apps/api/src/flow-hooks/start/home.ts` example with `guard`, `loader`, and `onSubmit`.
4. ~~Testing utilities.~~ Completed. `teleforge/test` exports `validateDiscoveredWiring(cwd)` and `createMockWebApp(overrides)`. The wiring validator asserts no gaps across all flows/steps/screens/actions.
5. ~~Framework thinning slice 1: remove `packages/bff` and all BFF-facing references.~~ Completed. `packages/bff` deleted. `@teleforgex/bff` removed from `.changeset/config.json`, `tsconfig.typedoc.json`, and docs. No runtime consumers existed.
6. ~~Framework thinning slice 2: replace old web resume/guard APIs with the current Mini App runtime and server hook bridge.~~ Completed. Removed `packages/web/src/flow/*` (FlowResumeProvider, resumeFlow, useFlowState, ExpiredFlowView, ResumeIndicator), `packages/web/src/guards/*` (useRouteGuard, CapabilityGuard, withRouteGuard, useManifestGuard, ManifestProvider), and `packages/web/src/coordination/{provider,context}.tsx` (CoordinationProvider, useFlowCoordination, useFlowNavigation, useReturnToChat). Moved `parseResumeParam` to `coordination/`. `useLaunchCoordination` is kept as the sole coordination hook. `teleforge/web` surface reduced from ~52 KB to ~25 KB. Corresponding tests and docs updated.
7. ~~Framework thinning slice 3: demote `teleforge/ui` from scaffold/runtime core and move starter UI into generated apps or examples.~~ Completed. Removed `./ui` export from `teleforge` package (deleted `src/ui.ts`, removed from `package.json` exports, `tsup.config.ts` entries, and `tsconfig.typedoc.json` paths). Removed `@teleforgex/ui` from `.changeset/config.json` fixed release group. `examples/starter-app` rewritten to use `teleforge/web` hooks and plain React markup instead of `teleforge/ui` primitives. `apps/task-shop` updated to import from `@teleforgex/ui` directly. Docs and READMEs updated to no longer teach `teleforge/ui` as a public surface.
8. ~~Framework thinning slice 4: internalize devtools and collapse public package identity toward `teleforge`.~~ Completed. Removed `@teleforgex/devtools` `bin` entry so the CLI is only available through the `teleforge` package (`npx teleforge`). `@teleforgex/devtools` remains published as a transitive dependency of `teleforge` but is no longer promoted as a public standalone package identity. Removed from benchmark size tracking (replaced with `teleforge` CLI), cleaned up `tsconfig.typedoc.json` path mappings, and restored to `.changeset/config.json` fixed release group.
9. ~~Companion dev services.~~ Completed. Added `dev.services` to `TeleforgeManifest` types and Zod schema. Updated `spawnCompanionServices` in `server.ts` to read explicit service definitions from `manifest.dev.services`, falling back to auto-discovery of `apps/bot` if none are declared. Each service supports `name`, `command`, and optional `health` endpoint. Health check polling reports startup status and warns on timeout. Added manifest test verifying explicit `dev.services` parsing.
10. ~~Flow authoring helpers.~~ Completed. Added `miniAppStep(screen, options?)`, `chatStep(message, actions?, options?)`, `openMiniAppAction(label, to, payload?)`, and `returnToChatAction(label, to)` to `packages/teleforge/src/flow-definition.ts`. These remove repetitive `type: "miniapp"` / `type: "chat"` boilerplate and make action intent explicit. Exported from `teleforge` main surface. Added 7 tests covering each helper and integration with `defineFlow`.
11. ~~Runtime debug panel expansion.~~ Completed. Extended `DiscoveredFlowRuntimeSessionDebugState` with `currentScreenId` (derived from miniapp step `screen`) and `lastTransition` (tracks fromStepId, toStepId, type, payload, timestamp). Added `trackTransition()` to the flow runtime debug tracker and instrumented action handlers, onSubmit handlers, Mini App launches, and chat handoffs. Updated the simulator UI to render a new "Active Sessions" pane with structured per-session data including flow id, step id, screen id, route, state key, latest transition, and chat handoff status. Kept raw `flowRuntime` JSON in the existing "Flow Continuity" pane for deep inspection.
12. ~~Documentation cutover pass.~~ Completed. Removed migration-era language from primary docs: "still contains" → "contains" in `framework-model.md`, "now emits/now hosts" → present tense in `developer-guide.md`, "Current status / is planned" → declarative notes in `miniapp-architecture.md`, "compatibility alias" → "is also available" in `getting-started.md` and `developer-guide.md`, "still remain / still lighter" → "known limitations" in `developer-guide.md`, "Current adapter location" with internal package path → public API focus in `miniapp-architecture.md`, and "still exist" → present tense in `README.md` and `developer-guide.md`.

This order removes the most visible DX friction first: metadata duplication, unclear errors, and missing validation.
