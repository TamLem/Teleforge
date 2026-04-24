# Developer Experience Roadmap

This document reviews the current Teleforge developer experience and records the next improvements that would make the framework easier to adopt and maintain.

Use this with [Developer Experience Target](./developer-experience-target.md). The target defines the desired end state; this roadmap tracks the practical gaps between that target and the current repository.

## Current Assessment

Teleforge has moved a long way toward the intended flow-first model.

Strong DX foundations already in place:

- application authors have a unified public package: `teleforge`
- public subpaths are clear: `teleforge/web`, `teleforge/bot`, `teleforge/server-hooks`, and `teleforge/core/browser`
- `teleforge.config.ts` is the app definition
- flows and screens are discovered by convention
- `teleforge generate client-manifest` creates client-safe flow metadata
- `teleforge dev` provides a simulator-first local workflow
- `teleforge doctor` validates common setup and environment failures
- `startTeleforgeBot()` and `startTeleforgeServer()` remove most manual runtime construction
- `teleforge start` provides a framework-owned production bootstrap for polling-first apps and discovered server hooks
- the scaffold generates a runnable workspace with bot, web, API placeholder, shared types, smoke tests, and pre-command manifest generation

The remaining DX work is less about inventing the model and more about making the default path feel smaller, clearer, and harder to misconfigure.

## Main Friction Points

### 1. First-run path still assumes repo context

The docs are good for someone inside this monorepo, but the public package story is thinner.

Current friction:

- top-level setup starts with `pnpm install` and `pnpm build` in the framework repo
- `packages/teleforge/README.md` is too small to sell or explain the public package
- the generator docs focus on local development of the generator instead of the published `create-teleforge-app` path
- a new developer has to infer when they are using Teleforge as a framework maintainer versus as an app author

Improvement:

- add an app-author quickstart that starts from the published package/generator path
- keep monorepo contributor setup separate from app-author setup
- expand `packages/teleforge/README.md` into a short public-package overview with imports, commands, app shape, and escape hatches

### 2. Manifest generation is still visible plumbing

The generated client manifest is useful and the scaffold runs it before common commands, but developers still need to understand a generated source file early.

Current friction:

- docs mention `apps/web/src/teleforge-generated/client-flow-manifest.ts` as a core file
- adding or renaming flows requires manifest regeneration awareness
- failures during manifest generation can feel like TypeScript/module-loader failures rather than flow-discovery failures

Improvement:

- make `teleforge dev` regenerate or validate the manifest automatically before serving
- make `teleforge doctor` compare discovered flows against the checked-in client manifest and report drift
- improve manifest-generation errors with flow file path, export name, and suggested fix
- consider moving the manifest to a framework-owned cache when checked-in source is not required

### 3. Production runtime ownership is close but incomplete

`teleforge start` now starts the bot and discovered server hooks through a shared runtime context. That is the right direction, but the supported production path is still polling-first.

Current friction:

- webhook delivery is represented in config, but live webhook bootstrap is explicitly unsupported by `startTeleforgeBot()`
- `teleforge start` starts hooks only when hooks are discovered, but docs need to be clearer about how that maps to hosting topology
- required secrets such as `TELEFORGE_FLOW_SECRET`, `MINI_APP_URL`, and phone-auth secrets are easy to discover only after startup fails or `doctor` is run

Improvement:

- implement and document webhook bootstrap for `teleforge start`
- add a production runtime matrix covering polling, webhook, server hooks, and static Mini App hosting
- make `teleforge doctor` report a readiness checklist for the selected delivery mode
- keep `createDiscoveredBotRuntime()` and lower-level bot primitives as documented escape hatches, not the normal path

### 4. Simulator is strong but needs app-specific repeatability

The simulator already covers the right loop: chat, Mini App iframe, fixtures, replay, profile state, and debug output.

Current friction:

- fixtures are mostly generic
- replay is useful for the last action, but less useful as a durable scenario test format
- it is not yet obvious how an app team should promote a useful simulator state into a regression test

Improvement:

- add app-owned fixture packs discovered from the workspace
- add a documented scenario file format and CLI runner
- support replaying multi-step saved scenarios, not only the latest command or callback
- expose simulator traces in a form that can be attached to bug reports or CI artifacts

### 5. Diagnostics should track the higher-level conventions

As Teleforge owns more wiring, `doctor` has to validate framework conventions instead of only checking files and environment variables.

Current friction:

- the easy path depends on conventions across config, flow files, screen files, generated manifest, env, and optional hooks
- some convention failures are only visible once `dev` or `start` is running

Improvement:

- validate duplicate or unresolved flow step routes
- validate all Mini App steps resolve to screen modules
- detect client manifest drift
- detect `requestPhoneAuthAction()` without the required phone-auth secret setup
- detect server-hook usage without reachable server-hook runtime configuration
- detect webhook mode when the configured webhook surface cannot be served by the selected runtime

### 6. Scaffold should hide generated plumbing better

The scaffold is a good default, but it still introduces several framework-owned files on day one.

Current friction:

- generated app authors see `apps/bot/src/index.ts`, `apps/bot/src/runtime.ts`, and generated client manifest files before they have written product code
- `apps/api` is useful as a placeholder, but it can imply that every app has a required API surface

Improvement:

- clearly label framework-owned generated files in comments and README text
- move optional API generation behind a flag once the default flow is stable
- keep `runtime.ts` only as the simulator bridge, and make that role explicit everywhere
- consider a minimal scaffold variant with only config, one flow, one screen, and no API placeholder

### 7. API reference needs a stronger narrative bridge

The generated TypeDoc output is useful after a developer knows what to import. The narrative docs should do more to route developers from tasks to APIs.

Current friction:

- public APIs are available, but docs sometimes teach concepts without a final "use this import" summary
- low-level escape hatches and default APIs are adjacent in exports, so intent is not always obvious from TypeDoc alone

Improvement:

- add "Public API Map" sections to major guides
- mark default-path APIs separately from escape-hatch APIs
- expand examples for `teleforge start`, server hooks, phone auth, and custom bot runtime overrides

## Priority Roadmap

### P0. Fix documentation consistency

Outcome:

- docs links resolve
- generated docs site includes DX target and roadmap pages
- app-author and framework-maintainer paths are clearly separated

Recommended work:

- add this roadmap to the docs site navigation
- include [Developer Experience Target](./developer-experience-target.md) in the generated docs site
- expand the public `teleforge` package README
- update the task implementation plan or mark completed slices as done

### P1. Make manifest drift impossible to miss

Outcome:

- developers can change flows without guessing whether generated client metadata is stale

Recommended work:

- run manifest validation in `teleforge doctor`
- make `teleforge dev` generate or validate before startup
- improve manifest error messages around invalid flow exports, duplicate ids, and missing files

### P2. Complete production bootstrap

Outcome:

- `teleforge start` is the normal production entrypoint for both polling and webhook apps

Recommended work:

- implement live webhook delivery in the high-level runtime path
- document hosting modes and required environment variables
- add doctor checks for each production mode

### P3. Improve simulator repeatability

Outcome:

- local simulator work can become a durable regression workflow

Recommended work:

- support app-owned fixture discovery
- add multi-step scenario replay
- add a CI-friendly scenario runner

### P4. Thin the starter scaffold

Outcome:

- new app authors primarily edit `teleforge.config.ts`, flow files, screen files, and optional hooks

Recommended work:

- make optional surfaces opt-in where practical
- reduce day-one exposure to generated runtime files
- document which generated files are framework-owned and rarely edited

## Definition of Done

The DX roadmap is complete when a new app author can:

- create an app without reading internal package docs
- run local development with one command
- add a flow and screen without manual runtime wiring
- catch missing screens, stale manifests, missing secrets, and unsupported runtime modes through `teleforge doctor`
- deploy through `teleforge start` using either polling or webhook delivery
- move from simulator exploration to repeatable regression scenarios

