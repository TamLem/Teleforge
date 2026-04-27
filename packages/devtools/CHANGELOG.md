# @teleforgex/devtools

## 0.2.0

### Minor Changes

Devtools updated to work with the action-first flow model:
- **Manifest generation**: `ClientFlowManifest` produces route/screen/action metadata instead of step graph metadata
- **Client manifest drift**: parser updated to handle new `{ flows: [...] }` object format (was array)
- **Doctor**: flow wiring checks and remediation messages updated for action-first concepts (`routes`, `actions`, `onContact`)
- **Dev simulator**: flow summary cards display routes instead of steps
- **Route derivation**: `createRoutesFromFlows` uses `miniApp.routes` entries instead of `miniApp.route`

### Patch Changes

- Updated dependencies

### Patch Changes

- Updated dependencies
- Updated dependencies [2fa207c]
  - @teleforgex/core@0.2.0

## 0.1.0

### Minor Changes

- 444df20: Prepare the next Teleforge framework release with the current post-1.0 work:
  - expand the coordinated framework release line
  - ship the simulator-first local development workflow and improved tunnel support
  - ship callback-query, scenario, replay, and diagnostics improvements in the simulator
  - ship the completed developer documentation set, including Telegram basics, first-feature, coordination, testing, deployment, and env-var guides

### Patch Changes

- Updated dependencies [444df20]
  - @teleforgex/core@0.1.0
