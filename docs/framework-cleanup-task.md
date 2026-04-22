# Framework Cleanup Task

## Purpose

Teleforge has evolved quickly from a package-first V1 toolkit into a flow-first unified framework. The core runtime path now exists, but cleanup has not caught up.

This task captures the cleanup needed to make the repo internally consistent and to make the public framework surface match the intended V2 model.

The cleanup goal is not to invent new runtime primitives. It is to remove transitional confusion, stale V1 vocabulary, duplicated compatibility paths, and public API leaks.

## Current Implementation Status

This cleanup slice has adopted the no-legacy-support stance.

Completed in this slice:

- removed the public `teleforge/bff` subpath from the unified package export map and build entries
- removed the public `teleforge/core` and `teleforge/devtools` subpaths from the unified package export map and build entries
- removed `@teleforgex/bff` from the unified `teleforge` package dependencies
- removed `runtime.mode` and `runtime.webFramework` from the canonical manifest schema and runtime type
- removed devtools fallback loading for `teleforge.app.json`; devtools now requires `teleforge.config.ts`
- removed Vite/Next runtime branching from the dev server path; the Mini App dev runtime is Vite
- changed devtools webhook checks to avoid Next/BFF framing
- made devtools dependency diagnostics fail app workspaces that still declare split `@teleforgex/*` packages
- removed `miniApp.component` from flow definitions, route derivation, generated scaffolds, and starter example flows
- rewrote the starter app README around `teleforge.config.ts`, discovered flows, screens, and the unified package
- rewrote the main app-facing docs around unified public imports, server hooks, and code-first config
- reframed package-level READMEs as internal implementation layers that point app authors back to `teleforge`
- updated Task Shop migration docs to mark unified package import cutover complete
- added entrypoint safety tests for `teleforge/web`, `teleforge/core/browser`, and `teleforge/server-hooks`
- added entrypoint safety coverage that asserts internal `teleforge/bff`, `teleforge/core`, and `teleforge/devtools` subpaths are not exported
- added a docs/example/scaffold guardrail script for forbidden public legacy phrasing
- hardened config/flow module loaders to pass child-process inputs through environment variables instead of eval argv, which avoids Node 24 + `tsx` loader argument swallowing

Still remaining after this slice:

- either fix or quarantine the known flaky devtools simulator timeout test
- wire the guardrail script into the root verification flow once the historical migration/task-doc whitelist is tightened
- continue shrinking historical migration docs after the runtime and app-facing docs have fully stabilized

## Current Cleanup Problem

The repo currently contains three overlapping models:

1. The intended V2 model:
   - `teleforge`
   - `teleforge.config.ts`
   - `defineFlow()`
   - discovered handlers/screens/server hooks
   - `TeleforgeMiniApp`
   - `teleforge/web`
   - `teleforge/server-hooks`

2. The old V1 package model:
   - `@teleforgex/core`
   - `@teleforgex/web`
   - `@teleforgex/bot`
   - `@teleforgex/bff`
   - `teleforge.app.json`
   - manual command/route wiring

3. Transitional compatibility code:
   - manifest loaders
   - `runtime.mode: "spa" | "bff"`
   - `runtime.webFramework: "vite" | "nextjs" | "custom"`
   - devtools checks that still expect `@teleforgex/*`
   - docs/examples that still teach old package boundaries
   - scaffold fields that are no longer part of the intended mental model

The result is a framework that works but still looks and feels like a collection of libraries in several places.

## Cleanup Principles

Apply these principles across the task:

- Public app authors should start with `teleforge`, not `@teleforgex/*`.
- Public docs should teach flows, screens, handlers, and optional server hooks first.
- `teleforge.config.ts` is the app source of truth.
- `teleforge.app.json` is not supported in app workspaces.
- BFF is not a public product mode.
- SPA vs Next.js vs BFF should not be presented as a user-facing framework choice.
- Browser-safe imports must stay browser-safe.
- Server-only imports must stay out of browser bundles.
- Internal packages can remain, but public surfaces should hide them unless explicitly documented as internals.

## Workstream 1: Public Package Surface Cleanup

### Problem

`packages/teleforge` currently works as the unified package, but several subpaths are raw compatibility re-exports:

- `teleforge/bff` -> `@teleforgex/bff`
- `teleforge/bot` -> `@teleforgex/bot`
- `teleforge/core` -> `@teleforgex/core`
- `teleforge/devtools` -> `@teleforgex/devtools`
- `teleforge/ui` -> `@teleforgex/ui`
- `teleforge/web` -> `@teleforgex/web` plus V2 screen runtime

This is useful during migration, but it leaks the old topology into the public framework story.

### Files To Inspect

- [packages/teleforge/package.json](/home/aj/hustle/tmf/packages/teleforge/package.json)
- [packages/teleforge/src/index.ts](/home/aj/hustle/tmf/packages/teleforge/src/index.ts)
- [packages/teleforge/src/bff.ts](/home/aj/hustle/tmf/packages/teleforge/src/bff.ts)
- [packages/teleforge/src/bot.ts](/home/aj/hustle/tmf/packages/teleforge/src/bot.ts)
- [packages/teleforge/src/core.ts](/home/aj/hustle/tmf/packages/teleforge/src/core.ts)
- [packages/teleforge/src/core-browser.ts](/home/aj/hustle/tmf/packages/teleforge/src/core-browser.ts)
- [packages/teleforge/src/devtools.ts](/home/aj/hustle/tmf/packages/teleforge/src/devtools.ts)
- [packages/teleforge/src/ui.ts](/home/aj/hustle/tmf/packages/teleforge/src/ui.ts)
- [packages/teleforge/src/web.ts](/home/aj/hustle/tmf/packages/teleforge/src/web.ts)
- [packages/teleforge/src/server-hooks-entry.ts](/home/aj/hustle/tmf/packages/teleforge/src/server-hooks-entry.ts)

### Tasks

1. Classify every `teleforge/*` subpath as one of:
   - public V2 surface
   - internal compatibility surface
   - deprecated transitional surface
   - removable surface

2. Decide whether these should remain public:
   - `teleforge/bff`
   - `teleforge/devtools`
   - `teleforge/core`

3. Keep these public unless a stronger design replaces them:
   - `teleforge`
   - `teleforge/bot`
   - `teleforge/web`
   - `teleforge/ui`
   - `teleforge/core/browser`
   - `teleforge/server-hooks`

4. Document the supported subpath list in package docs and main docs.

5. Add entrypoint safety tests:
   - `teleforge/web` does not import Node-only modules
   - `teleforge/core/browser` does not import Node-only modules
   - `teleforge/server-hooks` can import server-only modules
   - browser examples do not import `teleforge`, `teleforge/core`, or `teleforge/server-hooks` unless explicitly intended

### Acceptance Criteria

- Public docs describe one unified package surface.
- Browser-facing entries are explicitly tested for browser safety.
- Server-only entries are clearly isolated.
- Transitional compatibility subpaths are either removed, renamed, or documented as internal.

## Workstream 2: Remove Legacy Public Runtime Vocabulary

### Problem

The repo still exposes and validates runtime mode vocabulary that contradicts the V2 direction:

- `runtime.mode: "spa" | "bff"`
- `runtime.webFramework: "vite" | "nextjs" | "custom"`
- devtools output such as `SPA mode, vite`
- scaffold tests asserting `mode: "spa"`
- webhook-mode checks tied to `Next.js/BFF`

The migration plan explicitly says users should not choose between SPA, Next.js, or BFF modes.

### Files To Inspect

- [packages/core/src/manifest/schema.ts](/home/aj/hustle/tmf/packages/core/src/manifest/schema.ts)
- [packages/core/src/manifest/types.ts](/home/aj/hustle/tmf/packages/core/src/manifest/types.ts)
- [packages/devtools/src/commands/dev.ts](/home/aj/hustle/tmf/packages/devtools/src/commands/dev.ts)
- [packages/devtools/src/utils/manifest.ts](/home/aj/hustle/tmf/packages/devtools/src/utils/manifest.ts)
- [packages/devtools/src/utils/doctor/checks.ts](/home/aj/hustle/tmf/packages/devtools/src/utils/doctor/checks.ts)
- [packages/create-teleforge-app/src/templates.ts](/home/aj/hustle/tmf/packages/create-teleforge-app/src/templates.ts)
- [packages/create-teleforge-app/test/cli.smoke.mjs](/home/aj/hustle/tmf/packages/create-teleforge-app/test/cli.smoke.mjs)
- [examples/starter-app/teleforge.config.ts](/home/aj/hustle/tmf/examples/starter-app/teleforge.config.ts)
- [apps/task-shop/teleforge.config.ts](/home/aj/hustle/tmf/apps/task-shop/teleforge.config.ts)

### Tasks

1. Decide the replacement config vocabulary.

   Candidate:

   ```ts
   runtime: {
     adapter?: "vite";
     build?: {
       outDir?: string;
       basePath?: string;
     };
   }
   ```

   Or keep current fields internally but stop presenting them as public choices.

2. Remove or hide user-facing mode decisions:
   - no "SPA mode"
   - no "BFF mode"
   - no "Next.js mode"

3. Update devtools messages:
   - replace `Validated Teleforge app config (SPA mode, vite)` with something like `Validated Teleforge app config (Vite Mini App runtime)`

4. Update doctor checks:
   - stop requiring `@teleforgex/core`, `@teleforgex/web`, `@teleforgex/bot`, or `@teleforgex/bff` as public app dependencies
   - require `teleforge` unless checking an explicitly legacy workspace

5. Update scaffold output and tests.

### Acceptance Criteria

- New generated apps do not teach mode selection.
- Devtools no longer tells users they are in SPA/BFF mode.
- Doctor validates the unified `teleforge` dependency path.
- Any remaining old runtime fields are clearly internal or transitional.

## Workstream 3: Config and Manifest Compatibility Cleanup

### Problem

The repo now uses `teleforge.config.ts`, but legacy manifest behavior still appears in:

- docs
- core manifest loader
- devtools server search paths
- troubleshooting messages
- examples and older READMEs

Some compatibility may still be useful internally, but the public model is now config-first.

### Files To Inspect

- [packages/core/src/manifest/load.ts](/home/aj/hustle/tmf/packages/core/src/manifest/load.ts)
- [packages/core/src/manifest/schema.ts](/home/aj/hustle/tmf/packages/core/src/manifest/schema.ts)
- [packages/devtools/src/utils/server.ts](/home/aj/hustle/tmf/packages/devtools/src/utils/server.ts)
- [packages/teleforge/src/config.ts](/home/aj/hustle/tmf/packages/teleforge/src/config.ts)
- [docs/manifest-reference.md](/home/aj/hustle/tmf/docs/manifest-reference.md)
- [docs/troubleshooting.md](/home/aj/hustle/tmf/docs/troubleshooting.md)
- [docs/environment-variables.md](/home/aj/hustle/tmf/docs/environment-variables.md)
- [docs/deployment.md](/home/aj/hustle/tmf/docs/deployment.md)

### Tasks

1. Decide whether `teleforge.app.json` support is:
   - removed
   - retained as an internal legacy loader
   - retained only for migration tooling

2. If retained, mark it clearly in code and docs as legacy.

3. Update error messages:
   - missing config errors should point to `teleforge.config.ts`
   - manifest errors should only appear when explicitly loading a legacy manifest

4. Make `docs/manifest-reference.md` internally consistent:
   - either rename to config reference and update all links
   - or keep manifest reference as legacy and create a separate config reference

5. Update docs index labels to avoid "manifest" as the primary model.

### Acceptance Criteria

- A new user never sees `teleforge.app.json` as the default path.
- Legacy manifest support, if kept, is explicitly described as legacy.
- Config reference matches actual `defineTeleforgeApp()` and `defineFlow()` behavior.

## Workstream 4: Flow API and Runtime Cleanup

### Problem

There are two flow modules in the unified package:

- `flow-definition.ts`
- `flow.ts`

`flow.ts` includes older coordination/start-command helpers that bridge into the V1 bot/core packages. The current V2 runtime primarily uses discovered flows and `createDiscoveredBotRuntime()`.

### Files To Inspect

- [packages/teleforge/src/flow-definition.ts](/home/aj/hustle/tmf/packages/teleforge/src/flow-definition.ts)
- [packages/teleforge/src/flow.ts](/home/aj/hustle/tmf/packages/teleforge/src/flow.ts)
- [packages/teleforge/src/discovery.ts](/home/aj/hustle/tmf/packages/teleforge/src/discovery.ts)
- [packages/teleforge/src/bot-runtime.ts](/home/aj/hustle/tmf/packages/teleforge/src/bot-runtime.ts)
- [packages/teleforge/src/index.ts](/home/aj/hustle/tmf/packages/teleforge/src/index.ts)

### Tasks

1. Classify APIs in `flow.ts`:
   - current public API
   - internal helper
   - legacy compatibility helper

2. Decide whether `createFlowStartCommand()` and `createFlowCoordinationConfig()` remain public.

3. If they remain, document them as low-level escape hatches rather than the default path.

4. If they are legacy, remove them from the main `teleforge` root export and keep them under a compatibility/internal path if needed.

5. Ensure `defineFlow()` is the clear primary flow authoring API.

6. Review `FlowInstance` language:
   - current implementation still mostly uses `UserFlowStateManager` and state keys
   - new architecture docs describe future instance repositories
   - avoid claiming the future repository model is already implemented

### Acceptance Criteria

- Main `teleforge` export does not overexpose legacy coordination helpers as default APIs.
- Flow docs and examples consistently use `defineFlow()` plus discovered runtime.
- Future `FlowInstanceRepository` design is clearly separated from current runtime implementation.

## Workstream 5: Devtools Cleanup

### Problem

Devtools still has legacy concepts in diagnostics and fallback paths:

- package dependency checks expect `@teleforgex/*`
- simulator chat modes use `manifest` vs `workspace`
- server lookup still includes `teleforge.app.json`
- webhook mode is tied to Next.js/BFF assumptions
- route derivation logic overlaps with `packages/teleforge/src/discovery.ts`

### Files To Inspect

- [packages/devtools/src/utils/doctor/checks.ts](/home/aj/hustle/tmf/packages/devtools/src/utils/doctor/checks.ts)
- [packages/devtools/src/utils/dev-simulator.ts](/home/aj/hustle/tmf/packages/devtools/src/utils/dev-simulator.ts)
- [packages/devtools/src/utils/server.ts](/home/aj/hustle/tmf/packages/devtools/src/utils/server.ts)
- [packages/devtools/src/utils/manifest.ts](/home/aj/hustle/tmf/packages/devtools/src/utils/manifest.ts)
- [packages/devtools/src/commands/dev.ts](/home/aj/hustle/tmf/packages/devtools/src/commands/dev.ts)
- [packages/devtools/test/doctor.mjs](/home/aj/hustle/tmf/packages/devtools/test/doctor.mjs)
- [packages/devtools/test/dev.mjs](/home/aj/hustle/tmf/packages/devtools/test/dev.mjs)
- [packages/devtools/test/manifest.mjs](/home/aj/hustle/tmf/packages/devtools/test/manifest.mjs)

### Tasks

1. Rename user-facing simulator terminology:
   - `manifest` fallback -> `config fallback` or `static fallback`
   - `workspace` -> `flow runtime` where appropriate

2. Update dependency diagnostics to prefer the unified package:
   - required package: `teleforge`
   - internal packages only for repo/package development

3. Remove or clearly isolate legacy `teleforge.app.json` discovery.

4. Align devtools route derivation with the Teleforge package implementation to avoid drift.

5. Revisit webhook-mode messaging:
   - avoid "Next.js/BFF required" as public framing
   - frame webhook support around whether the workspace exposes the required HTTP endpoint

6. Keep the known flaky devtools simulator test documented until fixed.

### Acceptance Criteria

- Doctor output guides users toward `teleforge`, not split packages.
- Simulator output uses flow/config language, not manifest-first language.
- Devtools and `teleforge` route derivation cannot drift silently.
- Tests cover config-derived flows with `stepRoutes`, server hooks, and continuity diagnostics.

## Workstream 6: Scaffold Cleanup

### Problem

The scaffold has been updated toward V2 but still has transitional gaps:

- generated config still includes `runtime.mode: "spa"` and `webFramework: "vite"`
- generated flow includes `miniApp.component`, which is legacy/noisy
- generated API says "Teleforge BFF or local dev runtime"
- generated app is single-step and does not demonstrate `stepRoutes`
- generated `TeleforgeMiniApp` does not wire a server bridge
- generated API is a placeholder, not a server-hooks example

### Files To Inspect

- [packages/create-teleforge-app/src/templates.ts](/home/aj/hustle/tmf/packages/create-teleforge-app/src/templates.ts)
- [packages/create-teleforge-app/test/cli.smoke.mjs](/home/aj/hustle/tmf/packages/create-teleforge-app/test/cli.smoke.mjs)
- [packages/create-teleforge-app/README.md](/home/aj/hustle/tmf/packages/create-teleforge-app/README.md)
- [docs/scaffoling_update.md](/home/aj/hustle/tmf/docs/scaffoling_update.md)

### Tasks

1. Remove `miniApp.component` from generated flows unless it is intentionally supported.

2. Decide whether the scaffold should remain minimal or become a two-step demonstration.

   If expanded, include:
   - `home` Mini App step
   - `confirm` or `details` Mini App step
   - `done` chat step
   - `miniApp.stepRoutes`
   - return-to-chat action

3. Decide whether to include server bridge wiring by default:
   - minimal scaffold can omit it
   - reference scaffold should include `createFetchMiniAppServerBridge()`
   - if omitted, docs should explain what is not demonstrated

4. Replace BFF language in generated API placeholder.

5. Update scaffold smoke tests to assert V2 shape:
   - `teleforge.config.ts`
   - flow file
   - screen file
   - no `teleforge.app.json`
   - no `@teleforgex/*` app dependencies
   - no user-facing mode choice language

### Acceptance Criteria

- New projects generated by `create-teleforge-app` teach only the V2 model.
- Generated files do not include legacy fields unless explicitly documented.
- Scaffold README does not teach BFF, SPA, or split-package composition as setup choices.

## Workstream 7: Example App Cleanup

### Problem

Examples are currently split:

- Task Shop is substantially migrated and is the complex proof point.
- Starter app implementation is closer to V2, but its README still describes old `@teleforgex/*` packages and `teleforge.app.json`.
- Task Shop still has a dedicated import-cutover task for leftover legacy imports/dependencies/docs.

### Files To Inspect

- [examples/starter-app](/home/aj/hustle/tmf/examples/starter-app)
- [examples/starter-app/README.md](/home/aj/hustle/tmf/examples/starter-app/README.md)
- [apps/task-shop](/home/aj/hustle/tmf/apps/task-shop)
- [apps/task-shop/README.md](/home/aj/hustle/tmf/apps/task-shop/README.md)
- [apps/task-shop/docs/INTEGRATION_AUDIT.md](/home/aj/hustle/tmf/apps/task-shop/docs/INTEGRATION_AUDIT.md)
- [apps/task-shop/docs/UNIFIED_PACKAGE_IMPORT_CUTOVER.md](/home/aj/hustle/tmf/apps/task-shop/docs/UNIFIED_PACKAGE_IMPORT_CUTOVER.md)

### Tasks

1. Rewrite starter-app README:
   - `teleforge.config.ts`, not `teleforge.app.json`
   - `teleforge/web`, `teleforge/ui`, `teleforge/bot`
   - flows and screens first

2. Finish Task Shop import cutover:
   - replace direct `@teleforgex/bot` type imports with `teleforge/bot`
   - switch browser validation to `teleforge/core/browser`
   - remove stale `@teleforgex/*` dependencies from Task Shop manifests
   - refresh lockfile

3. Rewrite Task Shop docs as the complex flow-first reference:
   - discovered flows
   - discovered screens
   - `TeleforgeMiniApp`
   - `teleforge/server-hooks`
   - return-to-chat continuity

4. Ensure both examples run with the same mental model.

### Acceptance Criteria

- `rg -n '@teleforgex/' examples/starter-app apps/task-shop -S` returns only intentional package-name history or no results.
- Starter app and Task Shop docs both teach the unified package model.
- Task Shop remains the complex regression example.

## Workstream 8: Documentation Cleanup

### Problem

The docs still contain old package-first and manifest-first material. A dedicated documentation cutover task exists, but framework cleanup should track it as part of the larger cleanup.

### Files To Inspect

- [docs/documentation-cutover-task.md](/home/aj/hustle/tmf/docs/documentation-cutover-task.md)
- [docs/getting-started.md](/home/aj/hustle/tmf/docs/getting-started.md)
- [docs/developer-guide.md](/home/aj/hustle/tmf/docs/developer-guide.md)
- [docs/architecture.md](/home/aj/hustle/tmf/docs/architecture.md)
- [docs/first-feature.md](/home/aj/hustle/tmf/docs/first-feature.md)
- [docs/testing.md](/home/aj/hustle/tmf/docs/testing.md)
- [docs/bff-guide.md](/home/aj/hustle/tmf/docs/bff-guide.md)
- [docs/shared-phone-auth.md](/home/aj/hustle/tmf/docs/shared-phone-auth.md)
- [docs/local-development.md](/home/aj/hustle/tmf/docs/local-development.md)
- [docs/troubleshooting.md](/home/aj/hustle/tmf/docs/troubleshooting.md)

### Tasks

1. Execute [documentation-cutover-task.md](./documentation-cutover-task.md).

2. Rename or reframe docs:
   - `bff-guide.md` -> server-hook internals or backend internals
   - `manifest-reference.md` -> config reference, or split into config reference + legacy manifest reference

3. Mark future architecture docs clearly:
   - `flow-state-design.md` is future architecture unless implemented
   - pickup migration plan should not imply future repository APIs are already present

4. Add a docs lint/search gate for forbidden public phrasing.

### Acceptance Criteria

- Main docs lead with `teleforge.config.ts`, `defineFlow`, screens, and server hooks.
- Internal package names appear only in internal/legacy sections.
- BFF is not presented as a public app mode.
- Docs build passes.

## Workstream 9: Test and Guardrail Cleanup

### Problem

The migration needs mechanical guardrails so old concepts do not keep re-entering.

### Tasks

1. Add package-surface tests:
   - `teleforge/web` browser-safety
   - `teleforge/core/browser` browser-safety
   - `teleforge/server-hooks` server-only behavior

2. Add example import checks:
   - generated app has no `@teleforgex/*` dependencies
   - Task Shop runtime code has no direct `@teleforgex/*` imports
   - starter app docs do not reference `teleforge.app.json`

3. Add docs search checks for public docs:

   Suggested forbidden terms outside allowed files:
   - `teleforge.app.json`
   - `@teleforgex/`
   - `BFF mode`
   - `SPA mode`
   - `Next.js mode`
   - `createBotRuntime()` as default app entry
   - `CoordinationProvider` as default app integration

4. Decide where these checks live:
   - root `pnpm check`
   - docs build script
   - a new `pnpm migration:lint`

### Acceptance Criteria

- Regressions toward the old public model fail automated checks.
- Allowed legacy/internal references are intentionally whitelisted.
- Root verification remains practical for contributors.

## Suggested Execution Order

1. Public package surface cleanup.
2. Devtools dependency/runtime vocabulary cleanup.
3. Scaffold cleanup.
4. Example app cleanup.
5. Documentation cutover.
6. Config/manifest compatibility decision.
7. Flow API cleanup.
8. Guardrail tests and search checks.

This order keeps user-facing app generation and local dev coherent before doing deeper API pruning.

## Verification Commands

Run targeted checks while working:

```bash
pnpm --filter teleforge test
pnpm --filter create-teleforge-app test
pnpm --filter @teleforgex/devtools test
pnpm --dir apps/task-shop test
pnpm docs:build
```

Then run full verification:

```bash
pnpm check
```

Known caveat:

- `packages/devtools/test/dev.mjs` has had an older flaky timeout around `dev logs upstream app 500 responses for simulator app requests`. Keep this documented until fixed, but do not hide new failures behind it.

## Done Criteria

Framework cleanup is done when:

- generated apps depend on and teach `teleforge`, not split `@teleforgex/*` packages
- public docs start from flows/screens/handlers/server hooks
- `teleforge.config.ts` is the only default app definition
- `teleforge.app.json` is removed from the default path or clearly marked legacy
- devtools validates the unified package dependency model
- scaffold output contains no dead V1 fields
- Task Shop and starter app docs align with the V2 model
- browser/server package boundaries are tested
- legacy terms are either removed or explicitly marked internal/migration-only
- `pnpm check` passes, or any residual known flaky test is documented with a focused follow-up

## Non-Goals

Do not use this cleanup task to:

- remove internal packages solely for aesthetic reasons
- redesign the flow runtime from scratch
- implement the future `FlowInstanceRepository` architecture
- add backward compatibility for V1
- make broad behavior changes without tests

The goal is to make the evolved framework coherent and maintainable before the next feature slice.
