# Documentation Cutover Task

## Purpose

Cut over the main Teleforge documentation from the old package-first/V1 story to the unified flow-first framework story.

The framework implementation has moved materially toward:

- one public `teleforge` package
- `teleforge.config.ts` as the app source of truth
- `defineFlow()` as the primary authoring model
- discovered bot runtime execution
- discovered Mini App screens
- framework-owned `TeleforgeMiniApp`
- optional server hooks behind `teleforge/server-hooks`
- browser-safe Mini App imports behind `teleforge/web`
- Task Shop as the current complex example proving the model

The docs still partially teach the old mental model:

- package topology first
- `@teleforgex/*` packages as the user-facing model
- manifest-first phrasing
- SPA/BFF/frontend-mode framing
- Task Shop as a V1 stack example
- BFF as a visible app shape rather than an internal/server-hook implementation detail

This task is to make the public docs match the current direction and implementation state.

## Outcome

After this cutover, a new reader should understand Teleforge as:

- a unified TypeScript framework for Telegram-native apps
- authored through flows, screens, handlers, and optional server hooks
- run through one CLI/devtools workflow
- organized around app behavior rather than internal package boundaries

The reader should not need to understand the historical package split before building an app.

## Current Source Of Truth

Use these documents as the planning source:

- [Flow-First Developer Experience](./flow-first-dx.md)
- [Flow-First V2 Migration Plan](./flow-first-migration.md)
- [Flow-First Execution Handoff Plan](./flow-first-execution-plan.md)
- [Mini App Architecture Guidelines](./miniapp-architecture.md)
- [Task Shop unified package import cutover](../apps/task-shop/docs/UNIFIED_PACKAGE_IMPORT_CUTOVER.md)

Use current implementation and examples as the code source:

- [packages/teleforge](/home/aj/hustle/tmf/packages/teleforge)
- [apps/task-shop](/home/aj/hustle/tmf/apps/task-shop)

## Primary Docs To Rewrite

### 1. `docs/getting-started.md`

Current issue:

- still introduces Task Shop as a "complete V1 flow"
- still teaches examples through older command/data-flow framing before the flow-first model

Cutover target:

- start from `teleforge.config.ts`
- explain that apps are composed from flows and screens
- present `examples/starter-app` as the minimal flow-first starter
- present `apps/task-shop` as the complex flow-first reference app, not as a V1 stack
- show the default local workflow:
  - `pnpm install`
  - `pnpm build`
  - `pnpm dev`
  - `teleforge dev`
  - `teleforge dev --public --live`
- explain that `teleforge dev` loads config, discovers flows/screens, runs the Mini App, and can start companion bot services

Required edits:

- replace V1 language with flow-first language
- mention `TeleforgeMiniApp` and discovered screen modules
- describe optional server hooks only after the basic flow/screen path
- remove any implication that users choose between SPA, Next.js, or BFF modes as the main setup decision

### 2. `docs/developer-guide.md`

Current issue:

- closer to the new direction, but still frames some behavior as "current shipped packages"
- still links BFF prominently as a first-class guide
- needs stronger flow-authoring guidance

Cutover target:

- make this the main conceptual guide for the framework
- explain the authoring loop:
  - define `teleforge.config.ts`
  - define flows in `apps/bot/src/flows`
  - define Mini App screens in `apps/web/src/screens`
  - add step handlers or server hooks only when needed
  - run and inspect with `teleforge dev`
- explain that internal packages still exist but are not the app author's mental model
- describe Task Shop as the larger example to inspect for multi-step flow behavior

Required edits:

- add a clear "Flow-First Authoring Model" section
- add a "Screen Runtime" section
- add an "Optional Server Hooks" section that avoids BFF-as-product framing
- update links to point to `flow-first-dx.md`, `miniapp-architecture.md`, and Task Shop docs where useful

### 3. `docs/architecture.md`

Current issue:

- still starts from an internal package dependency graph
- still names `@teleforgex/core`, `@teleforgex/web`, `@teleforgex/bot`, and `@teleforgex/bff` as the practical framework model
- this is now too much internal topology for the public architecture story

Cutover target:

- explain architecture by runtime responsibility:
  - shared flow/runtime core
  - bot runtime
  - Mini App screen runtime
  - optional server-hook runtime
  - devtools/simulator
- explain public import surfaces:
  - `teleforge`
  - `teleforge/bot`
  - `teleforge/web`
  - `teleforge/ui`
  - `teleforge/server-hooks`
- mention `@teleforgex/*` only as internal implementation layers or migration history

Required edits:

- move package dependency graph below the runtime model or convert it into an "Internal Layers" section
- remove language that asks users to compose apps from `@teleforgex/*`
- explain why `teleforge/web` must remain browser-safe and why server execution is behind `teleforge/server-hooks`
- describe BFF as an internal implementation layer, not the recommended user concept

### 4. `docs/first-feature.md`

Current issue:

- likely needs to align examples with the new flow/screen/handler model

Cutover target:

- build a first feature by adding or editing a flow step
- show a chat step, a Mini App step, a screen module, and a submit/action transition
- avoid manual runtime wiring as the main lesson

Required edits:

- use `defineFlow()` and `defineScreen()` examples
- show where files live in generated apps
- keep server hooks as an optional extension after local flow handling works

### 5. `docs/testing.md`

Current issue:

- needs to reflect flow-first testing and the migrated Task Shop verification path

Cutover target:

- describe test levels:
  - flow definition tests
  - screen resolution/runtime tests
  - bot runtime tests
  - server-hook tests
  - simulator/devtools checks
  - example app tests such as `npx --yes pnpm@10.15.0 --dir apps/task-shop test`

Required edits:

- include current known flaky devtools simulator test as a residual risk if still present
- document expected verification commands for framework slices
- describe Task Shop as the complex-app regression suite

### 6. Task Shop docs

Files:

- [apps/task-shop/README.md](/home/aj/hustle/tmf/apps/task-shop/README.md)
- [apps/task-shop/docs/INTEGRATION_AUDIT.md](/home/aj/hustle/tmf/apps/task-shop/docs/INTEGRATION_AUDIT.md)
- [apps/task-shop/docs/UNIFIED_PACKAGE_IMPORT_CUTOVER.md](/home/aj/hustle/tmf/apps/task-shop/docs/UNIFIED_PACKAGE_IMPORT_CUTOVER.md)

Current issue:

- README and audit docs still contain V1/package-family language
- import cutover task documents remaining legacy `@teleforgex/*` references

Cutover target:

- Task Shop should read as the complex flow-first reference app
- docs should describe `teleforge.config.ts`, discovered flows, discovered screens, `TeleforgeMiniApp`, and return-to-chat continuity
- avoid teaching `@teleforgex/*` packages as the app-facing model

Required edits:

- update the README "What It Covers" section
- update integration audit checklist from V1 stack validation to flow-first runtime validation
- keep any historical or migration details clearly marked as transitional

## Secondary Docs To Triage

These may not need full rewrites, but they need a pass for stale framing:

- [manifest-reference.md](./manifest-reference.md)
- [flow-coordination.md](./flow-coordination.md)
- [miniapp-architecture.md](./miniapp-architecture.md)
- [bff-guide.md](./bff-guide.md)
- [local-development.md](./local-development.md)
- [deployment.md](./deployment.md)
- [troubleshooting.md](./troubleshooting.md)
- [README.md](./README.md)
- [site-home.md](./site-home.md)

Specific guidance:

- `manifest-reference.md` should explain manifests as internal/derived compatibility metadata if `teleforge.config.ts` is now primary.
- `bff-guide.md` should be renamed, demoted, or reframed as server-hook internals if it still reads like a public app mode.
- `flow-coordination.md` should clarify which APIs are low-level internals versus the default flow-first authoring model.
- `miniapp-architecture.md` should remain the frontend architecture source of truth and should be linked from the main docs.

## Messaging Rules

Apply these rules across the cutover:

- Lead with `teleforge`, not `@teleforgex/*`.
- Lead with flows, screens, handlers, and optional server hooks.
- Treat `teleforge.config.ts` as the app source of truth.
- Treat `teleforge.app.json` as legacy/migration-only.
- Treat BFF as internal implementation history unless a low-level server guide explicitly needs it.
- Do not present SPA vs Next.js vs BFF as a user-facing framework choice.
- Do not make users understand package topology before they can build.
- Use Task Shop as the complex proof point only after its remaining legacy imports/dependencies are either resolved or documented as transitional.

## Suggested Execution Order

1. Rewrite `docs/getting-started.md`.
2. Rewrite `docs/developer-guide.md`.
3. Rewrite `docs/architecture.md`.
4. Update `docs/first-feature.md`.
5. Update `docs/testing.md`.
6. Update Task Shop docs.
7. Triage secondary docs for stale package-first language.
8. Run docs verification.

## Verification

Run:

```bash
npx --yes pnpm@10.15.0 docs:build
```

Recommended additional checks:

```bash
rg -n '@teleforgex/|teleforge.app.json|BFF mode|SPA mode|Next.js mode|V1 stack' docs apps/task-shop
rg -n 'teleforge.config.ts|defineFlow|defineScreen|TeleforgeMiniApp|teleforge/server-hooks' docs
```

The first command should only return intentional historical or internal references.
The second command should confirm the main docs now teach the current framework model.

## Acceptance Criteria

This task is done when:

- the main docs teach `teleforge.config.ts` and flow-first authoring before internal package topology
- Getting Started can take a new developer from install to a flow-backed Mini App without V1 concepts
- Developer Guide explains flows, screens, handlers, and optional server hooks as the default model
- Architecture explains runtime responsibilities before internal packages
- Task Shop docs describe the migrated flow-first example rather than the old V1 stack
- references to `@teleforgex/*`, `teleforge.app.json`, public BFF mode, and frontend mode choices are either removed or clearly marked as internal/legacy
- `npx --yes pnpm@10.15.0 docs:build` passes

## Non-Goals

Do not use this task to:

- redesign the public API
- remove internal packages
- finish the Task Shop import cutover
- rewrite every historical design document
- add backwards-compatibility language for V1

The goal is documentation alignment with the current V2 direction, not another implementation slice.
