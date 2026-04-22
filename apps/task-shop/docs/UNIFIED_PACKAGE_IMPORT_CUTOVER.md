# Task Shop Unified Package Import Cutover

## Status

Complete for runtime code and package dependencies.

Task Shop now consumes the public Teleforge framework surfaces:

- `teleforge`
- `teleforge/web`
- `teleforge/ui`
- `teleforge/bot`
- `teleforge/core/browser`

The root package name remains an internal workspace identifier, not a framework dependency or public authoring import.

## Completed Work

- Bot runtime imports were moved to `teleforge` and `teleforge/bot`.
- Mini App screens and shell code were moved to `teleforge/web` and `teleforge/ui`.
- Browser validation now uses `teleforge/core/browser`.
- Task Shop package manifests no longer declare direct dependencies on internal framework packages.
- `teleforge.config.ts` is the only app config path.
- Runtime fields that modeled old frontend/backend modes were removed.
- Task Shop docs now describe the app as the flow-first reference implementation.

## Current Guardrail

This command should return no runtime-code imports from internal framework packages:

```bash
rg -n 'internal-framework-package-pattern' apps/task-shop -S
```

An internal workspace package name may still appear in `apps/task-shop/package.json`. That is not an import dependency and does not affect the unified app-authoring model.

## Follow-Up

No migration blocker remains in Task Shop for unified package imports.

Future Task Shop work should focus on product/runtime behavior:

- richer simulator scenarios for the migrated flow
- additional screen-runtime tests
- server-hook-backed examples for trusted submit/action paths
- documentation examples that show screen-level loaders and actions in realistic product flows
