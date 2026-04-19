# Task Shop Unified Package Import Cutover

## Purpose

Task Shop has mostly moved onto the unified `teleforge` package surface, but a small set of runtime imports, dependency declarations, and docs still reference the legacy `@teleforgex/*` packages.

This document explains:

- what still references the old packages
- why those references still exist
- which ones are simple migration leftovers
- which ones are blocked on missing unified-package exports
- the execution order to remove them cleanly

## Current Findings

### 1. Direct source import still using `@teleforgex/bot`

File:

- [apps/task-shop/apps/bot/src/telegram.ts](/home/aj/hustle/tmf/apps/task-shop/apps/bot/src/telegram.ts)

Current usage:

- type-only imports from `@teleforgex/bot`

Why it still exists:

- this file was kept as an app-local Telegram polling adapter during the flow-first migration
- the file only needs bot types, and those types are already available from `teleforge/bot`
- this is plain migration debt, not a framework limitation

Resolution:

- replace `@teleforgex/bot` with `teleforge/bot`

### 2. Browser validation hook still using `@teleforgex/core/validation/ed25519`

File:

- [apps/task-shop/apps/web/src/hooks/useInitDataValidation.ts](/home/aj/hustle/tmf/apps/task-shop/apps/web/src/hooks/useInitDataValidation.ts)

Current usage:

- `validateInitDataEd25519` imported from a legacy browser-safe deep path

Why it still exists:

- Task Shop needs this validation in browser code
- `teleforge/core` exists, but it currently re-exports the server-oriented `@teleforgex/core` index
- the old deep import was originally used to avoid pulling broader core/server code into the browser bundle
- this is not just leftover naming debt; it exposes a unified-package surface gap

What is missing in the framework:

- a clearly supported browser-safe unified import for browser-only core validation helpers

Acceptable end states:

- add `teleforge/core/browser`
- or add a dedicated browser-safe validation export such as `teleforge/browser` or `teleforge/validation`

Resolution rule:

- do not switch this import blindly to `teleforge/core` unless browser-bundle safety is explicitly verified and intended as the public contract

### 3. Workspace/package dependencies still declare legacy packages

Files:

- [apps/task-shop/package.json](/home/aj/hustle/tmf/apps/task-shop/package.json)
- [apps/task-shop/apps/web/package.json](/home/aj/hustle/tmf/apps/task-shop/apps/web/package.json)
- [apps/task-shop/pnpm-lock.yaml](/home/aj/hustle/tmf/apps/task-shop/pnpm-lock.yaml)

Current usage:

- root workspace still declares `@teleforgex/bot`, `@teleforgex/core`, and `@teleforgex/devtools`
- web package still declares `@teleforgex/core`

Why they still exist:

- some are now stale after the migration to `teleforge`
- some remain because the browser validation hook still imports a legacy core path
- the root `@teleforgex/devtools` declaration is especially likely to be removable because Task Shop now starts from the `teleforge` CLI

Resolution:

- remove stale root legacy dependencies after source imports are moved
- remove `apps/web` legacy core dependency after the browser-safe unified export exists and the hook is switched
- regenerate the lockfile after cleanup

### 4. Docs and sample copy still describe the old package model

Files:

- [apps/task-shop/README.md](/home/aj/hustle/tmf/apps/task-shop/README.md)
- [apps/task-shop/docs/INTEGRATION_AUDIT.md](/home/aj/hustle/tmf/apps/task-shop/docs/INTEGRATION_AUDIT.md)
- [apps/task-shop/packages/types/src/index.ts](/home/aj/hustle/tmf/apps/task-shop/packages/types/src/index.ts)

Current usage:

- README still explains Task Shop in V1 package terms
- integration audit still references `@teleforgex/core/browser`
- sample task copy still mentions `@teleforgex/bot`

Why it still exists:

- docs and fixture text were not fully rewritten during the runtime migration
- this is migration debt, not a technical blocker

Resolution:

- rewrite these references to the unified `teleforge` surface once the remaining browser-safe core import path is settled

## Root Cause Summary

There are two different causes mixed together.

### Cause A: plain migration leftovers

These should be changed directly:

- `apps/bot/src/telegram.ts`
- root workspace legacy dependency declarations that are no longer used
- Task Shop docs and sample copy

### Cause B: unified-package export gap

This is the actual framework issue:

- Task Shop browser code still needs a browser-safe validation import
- the old `@teleforgex/core/validation/ed25519` path currently fills that role
- the unified `teleforge` package does not yet expose an equally clear browser-safe replacement

Until that export exists, Task Shop cannot fully eliminate legacy package usage without either:

- reintroducing browser-bundle risk
- or switching to an unsupported/implicit import contract

## Resolution Plan

### Slice 1. Remove the easy leftover bot import

Files:

- [apps/task-shop/apps/bot/src/telegram.ts](/home/aj/hustle/tmf/apps/task-shop/apps/bot/src/telegram.ts)

Task:

- replace `@teleforgex/bot` type imports with `teleforge/bot`

Verification:

- `npx --yes pnpm@10.15.0 --dir apps/task-shop test`

### Slice 2. Add a browser-safe unified validation export

Framework scope:

- `packages/teleforge`

Task:

- expose a browser-safe public import for Ed25519 validation and similar browser-safe core helpers

Candidate shapes:

- `teleforge/core/browser`
- `teleforge/browser`
- `teleforge/validation`

Acceptance criteria:

- Task Shop browser code can stop importing `@teleforgex/core/validation/ed25519`
- the import contract is documented as public and intentional
- browser builds remain free of Node-only core code

Verification:

- `npx --yes pnpm@10.15.0 --filter teleforge test`
- `npx --yes pnpm@10.15.0 --dir apps/task-shop test`
- `pnpm --dir apps/task-shop dev`

### Slice 3. Remove legacy package dependencies from Task Shop

Files:

- [apps/task-shop/package.json](/home/aj/hustle/tmf/apps/task-shop/package.json)
- [apps/task-shop/apps/web/package.json](/home/aj/hustle/tmf/apps/task-shop/apps/web/package.json)
- [apps/task-shop/pnpm-lock.yaml](/home/aj/hustle/tmf/apps/task-shop/pnpm-lock.yaml)

Task:

- remove root declarations for legacy packages that are no longer imported directly
- remove web-package legacy core dependency after Slice 2 lands
- regenerate the lockfile

Acceptance criteria:

- no Task Shop workspace package declares `@teleforgex/*` dependencies unless there is a deliberate, documented transitional reason
- lockfile no longer carries Task Shop-local legacy package edges

### Slice 4. Rewrite Task Shop docs to the unified package story

Files:

- [apps/task-shop/README.md](/home/aj/hustle/tmf/apps/task-shop/README.md)
- [apps/task-shop/docs/INTEGRATION_AUDIT.md](/home/aj/hustle/tmf/apps/task-shop/docs/INTEGRATION_AUDIT.md)
- [apps/task-shop/packages/types/src/index.ts](/home/aj/hustle/tmf/apps/task-shop/packages/types/src/index.ts)

Task:

- remove old package-family references
- describe Task Shop through `teleforge`, `teleforge/web`, `teleforge/ui`, `teleforge/bot`, and any new browser-safe validation export from Slice 2

Acceptance criteria:

- Task Shop no longer teaches the legacy package topology
- sample text matches the current framework model

## Recommended Execution Order

1. Switch the easy bot import in `apps/bot/src/telegram.ts`.
2. Add the missing browser-safe unified export in `teleforge`.
3. Switch the browser validation hook to that new unified export.
4. Remove stale legacy dependencies and refresh the lockfile.
5. Rewrite Task Shop docs and sample copy.

## Done Criteria

This cleanup is done when:

- `rg -n '@teleforgex/' apps/task-shop -S` returns only intentionally preserved historical docs, or nothing
- Task Shop runtime code imports only `teleforge` public surfaces
- Task Shop package manifests no longer depend on legacy `@teleforgex/*` packages without a documented exception
- Task Shop docs describe the unified framework package model rather than the split-package V1 model
