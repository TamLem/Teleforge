# Flow-First V2 Migration Plan

This document describes how Teleforge moves from the current V1 architecture to the flow-first framework model described in [Flow-First Developer Experience](./flow-first-dx.md).

This is a **breaking V2 migration plan**. It assumes **no backward compatibility requirement** for:

- `teleforge.app.json`
- `@teleforgex/*` as the primary public package model
- manual runtime assembly as the default authoring model

The goal is not to wrap V1 more nicely. The goal is to replace the current user-facing model with a unified framework model.

## Current Status

The migration is already well underway.

Implemented in the repo now:

- a unified public `teleforge` package surface
- `teleforge.config.ts` loading and manifest derivation
- `defineFlow()` with typed chat and Mini App step definitions
- convention-based `*.flow.*` discovery
- a framework-owned discovered bot runtime helper
- scaffold output that defines `/start` through a flow instead of a handwritten command file
- starter-app using the same discovered runtime path as the scaffold
- route derivation from `flows.root`, so config no longer needs to import flows just to declare flow-owned routes
- devtools support for config-derived flow routes and workspace bot execution in the simulator
- devtools flow summaries surfaced in manifest loading, simulator state, and simulator diagnostics UI
- convention-based external flow handler discovery for step enter/submit/action wiring
- devtools flow completeness diagnostics, including step-level wiring status and unresolved handler gaps
- framework-owned bot execution for discovered chat-entry flows, callback actions, and chat-to-Mini-App transitions

That means the migration is no longer blocked on primitives or on the initial app path. The remaining work is mostly about **making flows the primary runtime object everywhere**, not about inventing the base framework APIs.

## Migration Goal

Teleforge V2 should make the developer experience:

- define an app in TypeScript
- define flows
- define handlers on steps and actions
- let the framework wire bot, Mini App, state, and backend behavior

That means the main migration is:

- from manifest-first to TypeScript app-definition-first
- from package-first to framework-first
- from manual registration to convention-first discovery
- from coordination helpers to flow execution as the default model

## Hard Cut Line

V2 should replace these V1 defaults:

- `teleforge.app.json` as the source of truth
- `createBotRuntime()` as the default app entry model
- `createBffConfig()` as the default first thing users assemble
- `CoordinationProvider` and related primitives as the first flow API users touch
- scaffold output that teaches developers to register commands, routes, and handlers manually
- docs that explain Teleforge primarily through package boundaries

V2 should replace them with:

- `teleforge.config.ts`
- `defineTeleforgeApp()`
- `defineFlow()`
- convention-owned discovery of flows, handlers, pages, and routes
- a single public framework package surface

## What Can Be Reused

V1 already contains useful execution substrate that V2 can build on internally:

- flow-state persistence and resume contracts in `core`
- signed launch and flow-context handling in `core` and `bot`
- Mini App return-to-chat and flow resume behavior in `web`
- Telegram-aware route execution, session, and identity layers in `bff`
- simulator, doctor, and local workflow infrastructure in `devtools`

These should be reused as implementation layers where possible, but they should stop being the primary authoring surface.

## Migration Workstreams

### 1. Create the new framework root

Add a new top-level public package surface centered on `teleforge`.

This surface should own:

- root exports such as `defineTeleforgeApp()` and `defineFlow()`
- subpath exports for specialized surfaces where needed
- the CLI/bin so installation and usage feel like one framework

Internal monorepo packages can remain during implementation, but V2 docs and generated apps should no longer teach the split-package model.

Status:

- complete for the current public surface

### 2. Replace the manifest with a TypeScript app definition

Add `teleforge.config.ts` as the new app source of truth.

It should describe:

- app identity
- flow roots
- bot defaults
- Mini App defaults
- BFF enablement
- dev and simulator settings

This config should be executable framework input, not just metadata.

`teleforge.app.json` should be removed from the default path entirely.

Status:

- mostly complete
- `teleforge.config.ts` exists and is loadable
- flow-owned routes are now derived from `flows.root`
- `routes` now serves as the explicit extra-route list instead of duplicating flow routes

### 3. Introduce the flow DSL

Build `defineFlow()` and the V2 flow runtime.

The flow layer should become the primary developer abstraction for:

- chat steps
- Mini App steps
- actions
- transitions
- flow state
- guards
- async loaders or submit handlers

This layer should compile down to the existing coordination, launch, resume, and return infrastructure where that is still useful.

Status:

- partially complete
- `defineFlow()` exists and supports typed flow definitions plus bot-entry and Mini App metadata
- flow actions now support stable action ids for external handler binding
- framework-owned chat-step execution now exists in the discovered bot runtime
- what does not exist yet is full framework-owned step execution across Mini App and backend surfaces

### 4. Add convention-based discovery

Move Teleforge from manual registration to framework-owned discovery.

The framework should discover and wire:

- flow definitions
- step or action handlers
- Mini App screens or route modules
- BFF routes needed by flows

The developer should not need to hand-assemble a bot runtime just to make a flow work.

Status:

- partially complete
- flow file discovery exists
- derived command registration exists
- a framework-owned discovered bot runtime exists and is used by the scaffold and starter app
- step-handler discovery now exists, including convention-based external step handler modules
- discovered bot runtime now executes chat-entry flows and callback-driven transitions through discovered handlers
- page/screen discovery and backend-hook discovery do not exist yet

### 5. Make devtools load the app model

`teleforge dev`, `teleforge doctor`, and related tooling must stop depending on `teleforge.app.json`.

Devtools should load `teleforge.config.ts`, derive the app structure from it, and boot the simulator around the flow model.

This is the biggest infrastructure migration because V1 devtools currently use the manifest deeply for:

- validation
- route and command consistency checks
- simulator boot
- file watching
- webhook and public URL diagnostics

Status:

- partially complete, but materially further along than before
- devtools can load `teleforge.config.ts`
- devtools can boot config-derived flow routes
- simulator workspace bot execution works with the unified package path
- devtools now surface discovered flow summaries plus step-level handler completeness in the simulator and loader output
- devtools still do not explain screen resolution, backend hooks, or Mini App/backend execution readiness beyond chat-handler diagnostics

### 6. Rebuild scaffolding around the new model

`create-teleforge-app` should generate V2 projects that start from:

- `teleforge.config.ts`
- `flows/*`
- convention-owned bot and Mini App files
- one framework dependency

Generated apps should work without manual command registration as the first edit.

Status:

- mostly complete for the bot/runtime path
- generated apps now use the framework-owned discovered runtime helper
- generated config no longer imports flow modules to build routes
- remaining work is around deeper flow handler conventions, not basic app boot

### 7. Rewrite docs and examples as V2-first

Once the V2 path boots end to end:

- rewrite the starter app to use the flow-first model
- update Task Shop to prove a non-trivial flow-first app
- rewrite Getting Started, Developer Guide, Architecture, and First Feature around flows and handlers
- demote or remove V1 manifest/package-boundary documentation from the main path

Status:

- partially complete
- starter-app is now on the discovered-flow runtime path
- Task Shop still reflects the older, more manually assembled model
- docs direction exists, but the main narrative is not fully rewritten yet

## What Is Still Wrong

The remaining migration work is no longer about basic framework wiring. It is about closing the last major conceptual gaps.

### 1. Flow discovery stops at route and command derivation

The framework can now discover flows and derive:

- bot entry commands
- coordination config
- flow-owned Mini App routes
- external step handler modules
- chat-step execution and callback-driven transitions inside the framework-owned bot runtime

But it still does not discover or execute:

- page or screen modules by convention
- backend handlers derived from flow definitions
- Mini App submit/return handling from flow definitions

That is the main missing jump from “framework scaffolding” to “flow-first application runtime”.

### 2. Devtools are ahead on visibility, but not yet on full execution insight

Devtools can now boot config-derived apps, surface discovered flow summaries, and show step-level handler diagnostics.

But the simulator and diagnostics should eventually understand:

- which screens or pages resolve for each Mini App step
- which backend hooks exist for a flow
- where a flow is incomplete because a screen, backend hook, or Mini App execution surface is missing

Until that happens, the runtime path is ahead of the devtools story.

### 3. Non-trivial example migration is still missing

The starter app is aligned now, but Teleforge still lacks a migrated complex example that proves:

- multi-step flows
- guarded Mini App routes
- backend-assisted flows
- realistic return-to-chat and resume behavior

Task Shop or an equivalent example needs to become that proof point.

### 4. The docs still describe too much of the old mental model

The repo now contains a direction document and a migration document, but the main teaching path still needs to flip from:

- packages
- manifests
- manual wiring

to:

- apps
- flows
- handlers
- framework-owned runtime conventions

## Recommended Implementation Order

The foundation phase is now complete enough that the next order should focus on runtime ownership, visibility, and a convincing example.

### Completed or mostly completed

1. Add the new `teleforge` package surface.
2. Add `teleforge.config.ts` and `defineTeleforgeApp()`.
3. Add `defineFlow()` and a first working flow runtime layer on top of current coordination primitives.
4. Add a framework-owned discovered bot runtime helper.
5. Rewrite scaffold and starter-app onto the discovered bot runtime path.
6. Collapse duplicated flow-route definition by deriving flow-owned routes from `flows.root`.
7. Add convention-based external flow handler discovery.

### Revised next order

1. Finish Mini App screen/page resolution and step execution.
2. Add backend hook discovery and execution where flows need server-side work.
3. Migrate Task Shop or another non-trivial example onto the same flow-first runtime model.
4. Extend devtools visibility across screen and backend resolution.
5. Rewrite the main docs around the now-concrete flow-first path.

This order is better because it finishes the actual framework model before spending more effort on documentation polish or further transitional helpers.

## Remaining Slices

The remaining implementation work should land as a small set of concrete slices.

### Slice 1. Handler discovery contract

Add a convention for binding executable handlers to discovered flows.

This should cover:

- chat-step enter and action handlers
- Mini App step submit handlers
- optional guards and loaders
- an explicit resolver model so Teleforge can tell whether a step is fully wired

Target outcome:

- flows are no longer just metadata
- the framework can answer “what code runs for this step?”

Status:

- complete for step-handler discovery
- external handler modules can now be discovered by convention and summarized alongside inline handlers

### Slice 2. Devtools completeness diagnostics

Extend the current flow summaries into actionable development diagnostics.

This should cover:

- discovered handlers per step
- whether a handler is inline or convention-discovered
- missing or unresolved runtime pieces
- step-to-command and route-to-flow traceability in the simulator

Target outcome:

- `teleforge dev` can explain incomplete flows, not just list them

Status:

- complete for handler-level visibility
- devtools now surface step status, resolved action counts, and unresolved handler/action gaps
- later devtools work should build on this for screen and backend visibility instead of revisiting basic handler summaries

### Slice 3. Bot-side flow execution

Use the discovered handler contract to execute flow transitions from bot interactions.

This should cover:

- command entry
- callback actions
- chat replies or text input where applicable
- typed transition results and state updates
- execution of convention-discovered external step handlers, not just inline handlers

Target outcome:

- a flow can progress through chat steps without app-specific router wiring

Status:

- partially complete
- framework-owned bot runtime now handles chat-entry command execution
- callback actions now resolve inline and convention-discovered handlers
- chat steps can now transition into Mini App steps through the framework runtime
- free-form text input, richer reply-keyboard interactions, and Mini App return execution are still outside this slice

### Slice 4. Mini App step and page resolution

Make Mini App step definitions resolve to screens or route modules by convention.

This should cover:

- screen-to-component lookup
- optional loaders or submit hooks
- return-to-chat integration from the framework path
- clear errors when a step references a missing screen
- devtools visibility into resolved screen ownership per step

Target outcome:

- Teleforge can own Mini App step execution, not just route metadata

Planned sub-slices:

1. Add screen/component resolution from `flows.root` conventions.
2. Add framework-owned Mini App submit and return handlers for discovered steps.
3. Surface resolved screen ownership and missing-screen errors in devtools.

### Slice 5. Backend hook discovery

Add optional backend execution points for flows.

This should cover:

- submit handlers that need server-side work
- identity-aware route execution where needed
- a framework-owned mapping from flow definitions to backend hooks
- devtools/runtime visibility for which flows depend on backend hooks

Target outcome:

- BFF behavior becomes flow-shaped instead of app-wired glue code

Planned sub-slices:

1. Define convention roots for flow-scoped backend hooks.
2. Map flow step submit handlers onto BFF execution points.
3. Surface backend-hook requirements and gaps in runtime summaries and devtools.

### Slice 6. Complex example migration

Migrate Task Shop or an equivalent non-trivial example onto the flow-first runtime.

This should prove:

- multi-step journeys
- guarded screens
- backend-assisted transitions
- realistic flow resume behavior
- convention-discovered handlers instead of hand-wired runtime glue

Target outcome:

- the repo has one serious example that demonstrates the V2 model end to end

Planned sub-slices:

1. Port one multi-step Task Shop flow onto `defineFlow()`.
2. Replace hand-wired bot/runtime glue with discovered handlers.
3. Prove guarded screens, backend-assisted transitions, and resume behavior from the framework path.

### Slice 7. Documentation cutover

Rewrite the main docs around the flow-first model after the runtime is complete enough to teach honestly.

This should cover:

- getting started from `teleforge.config.ts`
- defining flows and handlers
- local dev and simulator debugging
- complex app composition patterns

Target outcome:

- the docs match the actual framework mental model instead of the old package-first one

Planned sub-slices:

1. Rewrite getting started around `teleforge.config.ts`, `flows/*`, and handler conventions.
2. Rewrite framework guides around discovered runtime execution instead of package assembly.
3. Demote V1/package-boundary docs to migration or internal architecture references only.

## Current-to-V2 Mapping

The main conceptual replacements are:

| Current V1                                        | V2 target                                                      |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `teleforge.app.json`                              | `teleforge.config.ts`                                          |
| package-oriented mental model                     | framework-oriented mental model                                |
| `createBotRuntime()` + command registration       | discovered framework runtime from flow definitions             |
| `CoordinationProvider` as an app integration step | framework-owned flow execution                                 |
| `defineBffRoute()` as an entry concept            | optional backend surface derived from app and flow definitions |
| scaffolded manual wiring                          | scaffolded framework conventions                               |

## Acceptance Criteria

The migration is successful when:

- a new Teleforge app starts from `teleforge.config.ts`
- the primary app feature is expressed as a flow, not as package wiring
- the bot, Mini App, and return-to-chat lifecycle work from a framework-owned discovered runtime
- `teleforge dev` boots the app from the new config model
- `teleforge dev` can explain flow wiring state at the step level
- the starter example and the scaffold use the same framework path
- route ownership is no longer duplicated between config and flows
- generated apps use the unified framework package
- the main docs teach flows, handlers, and app definitions before package boundaries

## Non-Goals

This migration plan does not try to:

- preserve V1 import paths as first-class public API
- keep `teleforge.app.json` alive as an equal authoring model
- optimize for long-term dual support between V1 and V2
- fully redesign every internal package before delivering the new DX

The point of V2 is a cleaner framework model, not a prolonged compatibility layer.
