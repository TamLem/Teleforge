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
- browser-safe flow definitions for shared flow modules
- convention-based screen discovery for Mini App screens
- a framework-owned Mini App shell and screen registry entrypoint
- starter-app Mini App rendering through the framework-owned shell instead of app-local screen selection
- generated scaffolds now emit one default Teleforge app shape instead of asking users to choose a public SPA versus BFF mode
- generated Mini Apps now start from `TeleforgeMiniApp`, screen modules, and `teleforge.config.ts`
- Mini App state snapshots now persist across in-app step transitions
- real Mini App-to-chat handoff now flows back through `web_app_data` into the discovered bot runtime
- convention-based server-hook discovery now exists for flow-scoped guard/loader/submit/action logic
- the framework now exposes both an HTTP fetch bridge and a discovered server-hooks request handler
- runtime summaries and devtools diagnostics now surface server-hook wiring alongside local handler completeness

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

## Adopted Frontend Architecture Decisions

The Mini App side of V2 should not be treated as a generic website and not as a thin renderer bolted onto the bot runtime.

The adopted direction is:

- Teleforge Mini Apps are a **screen runtime**
- screens are bound to flow steps or explicit launch intents
- the product abstraction remains `flow -> step -> screen -> transition`
- routes exist as delivery/runtime machinery, not as the primary authoring model

This means the frontend architecture for the remaining V2 work should follow these rules.

### 1. The frontend is a screen runtime, not a monolithic SPA

Mini App steps should resolve to registered screens with:

- flow context
- step context
- optional loader data
- typed submit/action contracts
- runtime-owned transition handling

Developers should author screens and flow steps, not arbitrary page trees.

### 2. Teleforge owns the product model; the web framework owns delivery

The framework should keep:

- flow definitions
- step metadata
- screen identity
- loader/guard/submit/action contracts
- transition ownership

The underlying frontend runtime should provide:

- route delivery
- SSR or pre-render entry where useful
- client-side transitions after boot
- code splitting and hydration machinery

For V2 planning purposes, Teleforge should use one default delivery/runtime stack internally rather than exposing multiple user-facing frontend modes.

That means:

- users should not choose between "SPA mode", "Next.js mode", or other framework-branded frontend modes
- the concrete web runtime remains an implementation detail of Teleforge
- the authoring model stays `app -> flow -> step -> screen`
- the generated app and docs should present one Mini App model, not a framework comparison

### 3. Use a hybrid rendering model

The frontend target is not a full upfront SPA payload.

The architecture should favor:

- a small persistent Mini App shell
- initial shell or first-screen render via SSR/pre-render where useful
- selective hydration of interactive surfaces
- screen-level lazy loading and chunking
- client-driven transitions after initial boot

This should be reflected in the remaining slices, especially screen resolution and shell/runtime ownership.

The important constraint is that this should remain one default runtime behavior, not a user-facing render-mode matrix.

### 4. Add an explicit runtime bridge/server layer

The migration plan should treat Mini App execution as a bridge-backed runtime when server authority is required, not as direct screen-to-database glue.

When present, that bridge layer should own:

- flow instance loading
- guard execution
- loader execution
- submit/action endpoints
- transition resolution
- auth/session validation
- persistence and logging

This is the right place for authoritative flow validation. The frontend remains an untrusted client.

This should not be taught as a separate "BFF product" that users are expected to assemble up front.

Instead:

- server-backed flow hooks are optional framework behavior
- apps that do not need custom server authority should not be forced into a visible BFF model
- apps that do need server authority should use framework-owned flow hooks, not hand-wired backend concepts as the first abstraction

### 4.1 BFF is not a V2 public concept

The current repo has a `packages/bff` implementation layer, but V2 should not preserve `BFF` as a public framework concept that users are asked to reason about.

The intended V2 stance is:

- users build apps through flows, screens, handlers, and optional server hooks
- users do not start by choosing or assembling a BFF
- server-backed behavior is introduced only when a flow needs trusted server execution

During migration:

- `packages/bff` may remain temporarily as an internal implementation module
- its responsibilities may later be renamed, collapsed, or redistributed behind the unified `teleforge` surface
- docs and scaffolds should stop teaching `BFF` as a first-class app shape

The public DX target is:

- `flows + screens + optional server hooks`

not:

- `bot + web + bff` composition

### 5. Keep state boundaries explicit

The remaining runtime work should distinguish:

- local UI state: screen-only transient state
- flow state: durable shared state across chat and Mini App
- domain state: persistent application state outside the flow instance
- derived view state: computed data that usually should not be persisted directly

This should shape the runtime bridge APIs and the screen hook model.

### 6. Model Telegram-specific behavior as a capability layer

Telegram WebApp APIs should not be used ad hoc across screens.

V2 should expose a clean capability layer for:

- main button
- back button
- theme and viewport
- haptics
- share/close/expand and related client integrations

This belongs in the Mini App shell/runtime layer, not in arbitrary screen code.

## Hard Cut Line

V2 should replace these V1 defaults:

- `teleforge.app.json` as the source of truth
- `createBotRuntime()` as the default app entry model
- `createBffConfig()` or any user-facing backend assembly as the default first thing users assemble
- `CoordinationProvider` and related primitives as the first flow API users touch
- scaffold output that teaches developers to register commands, routes, and handlers manually
- docs that explain Teleforge primarily through package boundaries
- docs that force users to think in terms of SPA vs Next.js vs BFF mode choices

V2 should replace them with:

- `teleforge.config.ts`
- `defineTeleforgeApp()`
- `defineFlow()`
- convention-owned discovery of flows, handlers, screens, and optional server hooks
- a single public framework package surface
- one default Teleforge Mini App runtime model

## What Can Be Reused

V1 already contains useful execution substrate that V2 can build on internally:

- flow-state persistence and resume contracts in `core`
- signed launch and flow-context handling in `core` and `bot`
- Mini App return-to-chat and flow resume behavior in `web`
- Telegram-aware route execution, session, and identity layers in `bff`
- simulator, doctor, and local workflow infrastructure in `devtools`

These should be reused as implementation layers where possible, but they should stop being the primary authoring surface.

For clarity:

- `packages/bff` may continue to exist during migration for implementation reuse
- that does not mean `BFF` remains a user-facing framework abstraction
- if a later rename or consolidation makes the public model simpler, that is aligned with this plan

## Migration Workstreams

### 1. Create the new framework root

Add a new top-level public package surface centered on `teleforge`.

This surface should own:

- root exports such as `defineTeleforgeApp()` and `defineFlow()`
- subpath exports for specialized surfaces where needed
- the CLI/bin so installation and usage feel like one framework
- the hiding of internal package/runtime boundaries from app authors

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
- optional server-hook enablement where needed
- dev and simulator settings

It should not require:

- a separate BFF section as part of the default app story
- a frontend mode choice
- internal package knowledge

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
- screen identity and render hints for Mini App steps

This layer should compile down to the existing coordination, launch, resume, and return infrastructure where that is still useful.

Status:

- partially complete
- `defineFlow()` exists and supports typed flow definitions plus bot-entry and Mini App metadata
- flow actions now support stable action ids for external handler binding
- framework-owned chat-step execution now exists in the discovered bot runtime
- browser-safe flow definition exports now exist for Mini App-side consumption
- what does not exist yet is full framework-owned step execution across Mini App and backend surfaces

### 4. Add convention-based discovery

Move Teleforge from manual registration to framework-owned discovery.

The framework should discover and wire:

- flow definitions
- step or action handlers
- Mini App screens or route modules
- optional server hooks needed by flows

The developer should not need to hand-assemble a bot runtime just to make a flow work.

Status:

- partially complete
- flow file discovery exists
- derived command registration exists
- a framework-owned discovered bot runtime exists and is used by the scaffold and starter app
- step-handler discovery now exists, including convention-based external step handler modules
- screen discovery now exists for Mini App screen modules
- discovered bot runtime now executes chat-entry flows and callback-driven transitions through discovered handlers
- backend-hook discovery does not exist yet

### 5. Make devtools load the app model

`teleforge dev`, `teleforge doctor`, and related tooling must stop depending on `teleforge.app.json`.

Devtools should load `teleforge.config.ts`, derive the app structure from it, and boot the simulator around the flow model.

This is the biggest infrastructure migration because V1 devtools currently use the manifest deeply for:

- validation
- route and command consistency checks
- simulator boot
- file watching
- webhook and public URL diagnostics

Devtools should describe the app in public framework terms:

- flows
- screens
- handlers
- optional server hooks

and not in terms of internal package categories.

Status:

- partially complete, but materially further along than before
- devtools can load `teleforge.config.ts`
- devtools can boot config-derived flow routes
- simulator workspace bot execution works with the unified package path
- devtools now surface discovered flow summaries plus step-level handler completeness in the simulator and loader output
- devtools now surface resolved Mini App screen ownership for discovered steps
- devtools still do not explain backend hooks or Mini App/backend execution readiness beyond chat and screen diagnostics

### 6. Rebuild scaffolding around the new model

`create-teleforge-app` should generate V2 projects that start from:

- `teleforge.config.ts`
- `flows/*`
- convention-owned bot and Mini App files
- one framework dependency

Generated apps should work without manual command registration as the first edit.

Status:

- mostly complete
- generated apps now use the framework-owned discovered runtime helper
- generated config no longer imports flow modules to build routes
- generated apps now start from one Mini App shell + screen model instead of a public mode switch
- remaining work is around deeper flow execution and server-hook conventions, not basic app boot

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

- optional server-backed flow hooks derived from flow definitions
- Mini App submit/return handling from flow definitions
- full Mini App loader/guard/submit execution from flow definitions

That is the main missing jump from “framework scaffolding” to “flow-first application runtime”.

### 2. Devtools are ahead on visibility, but not yet on full execution insight

Devtools can now boot config-derived apps, surface discovered flow summaries, show step-level handler diagnostics, and point Mini App steps at their resolved screen modules.

But the simulator and diagnostics should eventually understand:

- which optional server hooks exist for a flow
- where a flow is incomplete because a screen, server hook, or Mini App execution surface is missing

Until that happens, the runtime path is ahead of the devtools story.

### 3. Non-trivial example migration is still missing

The starter app is aligned now, but Teleforge still lacks a migrated complex example that proves:

- multi-step flows
- guarded Mini App routes
- server-assisted flows where needed
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
- screens and handlers
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

1. Finish Mini App screen resolution, loader/guard execution, and step submit/return handling.
2. Add optional server-hook discovery and execution where flows need server-side work.
3. Migrate Task Shop or another non-trivial example onto the same flow-first runtime model.
4. Extend devtools visibility across screen and server-hook resolution.
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

Make Mini App step definitions resolve to screens inside a framework-owned Mini App runtime.

This should cover:

- a small persistent Mini App shell
- screen registry and screen-to-component lookup
- framework-owned route entrypoints that host Teleforge screens
- optional loaders and guards per step
- submit and action bridge wiring for the active step
- return-to-chat integration from the framework path
- clear errors when a step references a missing screen
- devtools visibility into resolved screen ownership per step

Target outcome:

- Teleforge can own Mini App step execution, not just route metadata

Status:

- mostly complete
- the framework-owned Mini App shell, screen registry, and screen discovery now exist
- starter-app now renders through `TeleforgeMiniApp`
- generated apps now follow the same screen-first Mini App shape
- screen-level guard and loader hooks now execute through the framework-owned Mini App runtime
- Mini App submit transitions and action execution now have framework-owned runtime helpers
- the Mini App shell now owns intra-Mini-App step progression
- flow snapshots now persist across Mini App transitions
- real return-to-chat/resume handoff now flows through Telegram `web_app_data` back into the discovered bot runtime

Remaining sub-slices:

1. Surface Mini App transition progress and return-to-chat handoff behavior more clearly in devtools.
2. Expand cross-surface resume coverage from the starter path to more complex multi-step flows.

### Slice 5. Optional server-hook discovery

Add the runtime bridge/server layer for flow-aware Mini App execution and optional server hooks.

This should cover:

- authoritative flow instance loading
- auth/session and flow-ownership validation
- loader execution entrypoints
- submit handlers that need server-side work
- action execution that needs server authority
- identity-aware route execution where needed
- a framework-owned mapping from flow definitions to server hooks
- devtools/runtime visibility for which flows depend on server hooks

Target outcome:

- server-backed flow behavior becomes flow-shaped instead of app-wired glue code

Status:

- partially complete
- the runtime bridge contract now exists for loader, submit, and action execution
- convention roots now resolve flow-scoped server hook modules
- the framework now provides a fetch bridge plus a discovered server-hooks request handler
- Mini App runtime execution can now delegate to authoritative server hooks
- runtime summaries and devtools diagnostics now surface server-backed guard/loader/submit/action wiring

Remaining sub-slices:

1. Add flow-ownership, identity, and auth/session validation to the server-hook bridge path where flows require trusted access.
2. Expand server-hook support beyond Mini App execution into richer end-to-end app routes when needed.
3. Make the starter/example app path demonstrate a real server-backed flow, not just the bridge primitives.

Public API rule for this slice:

- no new user-facing `BFF mode`
- no requirement that users import or think about a `bff` package
- server capabilities should surface as flow-level hooks or config, not as a separate app topology choice

### Slice 6. Complex example migration

Migrate Task Shop or an equivalent non-trivial example onto the flow-first runtime.

This should prove:

- multi-step journeys
- guarded screens
- server-assisted transitions where needed
- screen-runtime execution inside the Mini App shell
- realistic flow resume behavior
- convention-discovered handlers instead of hand-wired runtime glue

Target outcome:

- the repo has one serious example that demonstrates the V2 model end to end

Planned sub-slices:

1. Port one multi-step Task Shop flow onto `defineFlow()`.
2. Replace hand-wired bot/runtime glue with discovered handlers and screen registration.
3. Prove guarded screens, backend-assisted transitions, and resume behavior from the framework path.

### Slice 7. Documentation cutover

Rewrite the main docs around the flow-first model after the runtime is complete enough to teach honestly.

This should cover:

- getting started from `teleforge.config.ts`
- defining flows, screens, and handlers
- local dev and simulator debugging
- complex app composition patterns

Target outcome:

- the docs match the actual framework mental model instead of the old package-first one

Planned sub-slices:

1. Rewrite getting started around `teleforge.config.ts`, `flows/*`, screens, and handler conventions.
2. Rewrite framework guides around screen runtime, discovered execution, and optional server hooks instead of package assembly or mode choices.
3. Demote V1/package-boundary docs to migration or internal architecture references only.

## Current-to-V2 Mapping

The main conceptual replacements are:

| Current V1                                        | V2 target                                                      |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `teleforge.app.json`                              | `teleforge.config.ts`                                          |
| package-oriented mental model                     | framework-oriented mental model                                |
| `createBotRuntime()` + command registration       | discovered framework runtime from flow definitions             |
| `CoordinationProvider` as an app integration step | framework-owned flow execution                                 |
| raw web routes/pages as the product model         | screen runtime hosted by framework-owned route entrypoints     |
| SPA vs Next.js vs BFF mode choice                 | one default Teleforge app model                                |
| `defineBffRoute()` as an entry concept            | optional server hook/runtime bridge derived from flows         |
| scaffolded manual wiring                          | scaffolded framework conventions                               |

## Acceptance Criteria

The migration is successful when:

- a new Teleforge app starts from `teleforge.config.ts`
- the primary app feature is expressed as a flow, not as package wiring
- the bot, Mini App, and return-to-chat lifecycle work from a framework-owned discovered runtime
- Mini App screens resolve from a framework-owned screen runtime, not ad hoc route wiring
- the Mini App shell remains small and screen-level code is lazy-loaded by default
- authoritative submit/action/guard/loader execution happens through the runtime bridge/server layer when needed
- `teleforge dev` boots the app from the new config model
- `teleforge dev` can explain flow wiring state at the step level
- the starter example and the scaffold use the same framework path
- route ownership is no longer duplicated between config and flows
- generated apps expose one Teleforge app model without mode-selection complexity
- the main docs teach flows, screens, handlers, and app definitions before package boundaries or internal package topology
- `BFF` is no longer taught as a public Teleforge concept
- optional server-backed behavior is explained only as flow-level server hooks when needed

## Non-Goals

This migration plan does not try to:

- preserve V1 import paths as first-class public API
- keep `teleforge.app.json` alive as an equal authoring model
- optimize for long-term dual support between V1 and V2
- fully redesign every internal package before delivering the new DX

The point of V2 is a cleaner framework model, not a prolonged compatibility layer.
