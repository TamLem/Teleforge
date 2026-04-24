# Developer Experience Implementation Plan

This document describes how Teleforge moves from the current runtime model to the desired developer experience described in [Developer Experience Target](../docs/developer-experience-target.md).

For the current DX review and prioritized follow-up work, see [Developer Experience Roadmap](../docs/developer-experience-roadmap.md). This task plan is retained as implementation history, and some slices below have already landed.

The intent is not to rewrite the framework in one step.

The implementation plan should:

- preserve delivery momentum
- reduce framework leakage incrementally
- keep the flow-first authoring model stable
- absorb bootstrap complexity into the framework over time

## Current State

Teleforge already provides a strong flow-first model:

- discovered flows
- discovered screens
- generated client-safe Mini App manifest
- simulator-first local development
- trusted server hook bridge
- flow authoring helpers
- phone sharing helpers
- unified phone-auth flow helper

The remaining DX gap is mostly around runtime ownership and default wiring.

Today, the framework still exposes internal assembly details in places such as:

- explicit bot runtime construction
- explicit polling/webhook startup decisions in app code
- explicit hooks server startup in app code
- explicit secret/env plumbing in runtime bootstrap files

These are not design failures, but they are still framework concerns leaking into normal application setup.

## Target Outcome

The desired end state is:

- app authors define flows, screens, and hooks
- Teleforge owns default runtime bootstrap
- local commands orchestrate the required processes automatically
- advanced apps can still override defaults where necessary

## Implementation Principles

### 1. Preserve the flow-first API

The public authoring model around:

- `defineTeleforgeApp()`
- `defineFlow()`
- `defineScreen()`
- `chatStep()`
- `miniAppStep()`
- action helpers

should remain stable.

The DX work should reduce runtime wiring, not force repeated authoring-model churn.

### 2. Move complexity downward

When a choice is common and framework-owned, it should move into:

- the CLI
- discovered runtime helpers
- framework conventions

When a choice is application-specific, it should remain configurable through explicit escape hatches.

### 3. Default to conventions, not required boilerplate

The common path should not require framework scaffolding files whose only job is to call framework boot helpers.

If those files remain, they should be:

- minimal
- generated
- rarely edited by app authors

## Execution Slices

### Slice 1. High-level bot bootstrap API — Completed for polling/default path

Introduce a public high-level bot bootstrap API, such as:

```ts
await startTeleforgeBot();
```

Responsibilities:

- load `teleforge.config.ts`
- resolve env
- create the discovered bot runtime
- choose polling/webhook behavior from config
- start the selected delivery mode

This should wrap `createDiscoveredBotRuntime()` rather than replacing it immediately.

Keep `createDiscoveredBotRuntime()` as the lower-level escape hatch.

**Status**: `startTeleforgeBot()` implemented with preview-mode auto-detection, polling startup, custom bot override, and config-driven delivery mode. Live webhook delivery is explicitly rejected in the high-level bootstrap; use the lower-level escape hatch for webhook mode. Committed in `41e34ed`.

### Slice 2. Framework-owned hooks server bootstrap — Completed

Introduce a high-level server bootstrap path for flow hooks and chat handoff.

Possible shape:

```ts
await startTeleforgeServer();
```

Responsibilities:

- create the discovered server hooks handler
- expose the default hooks route
- wire `chatHandoff`
- use the same storage/runtime context as the bot bootstrap where relevant

This removes the need for app authors to hand-wire hooks server startup in standard Teleforge apps.

**Status**: `startTeleforgeServer()` implemented with CORS, auto-assigned port, shared storage, request error boundary, and `runtime.server.port` config support. Committed in `41e34ed`.

### Slice 3. Unified `teleforge start` — Completed for polling/default path

Add a production-oriented CLI command:

```bash
teleforge start
```

Responsibilities:

- start the bot runtime
- start the trusted server runtime if required
- start only the surfaces used by the app
- honor config for polling vs webhook mode

The command should let a standard Teleforge app run without custom bootstrap files in the common case.

**Status**: `teleforge start` CLI intercepts the `start` command, boots polling bot via `startTeleforgeBot()`, conditionally starts server with shared storage and `onChatHandoff` wiring, graceful shutdown, and delegates other commands to devtools. Webhook delivery requires the lower-level escape hatch today. Committed in `41e34ed`.

### Slice 4. Config-driven runtime ownership — Completed for polling/default path

Extend `teleforge.config.ts` so runtime intent can be declared directly.

Examples:

- bot delivery mode
- webhook enablement
- trusted hooks enablement
- phone-auth secret env name
- local/production port defaults

This keeps runtime choices in one place instead of scattering them across bootstrap files and environment-specific code.

**Status**: `TeleforgeRuntime` extended with `bot.delivery`, `server.port`, and `phoneAuth.secretEnv`. Zod schema validates. `startTeleforgeBot()` reads delivery mode and rejects webhook in live mode (polling is the supported default). `startTeleforgeServer()` reads default port. Committed in `b53fce0`.

### Slice 5. Shared runtime context container — Completed

Create an internal framework-owned runtime context that resolves once and is reused across:

- bot runtime
- server hooks runtime
- local development tooling

The shared runtime context should include:

- loaded app config
- secrets/env
- services
- storage
- runtime URLs

This reduces duplicated initialization logic and keeps framework-owned runtime surfaces consistent.

**Status**: `createTeleforgeRuntimeContext()` created, resolving config, secrets, storage once. Both boot functions accept optional `context`; CLI creates one context and shares it. `startTeleforgeBot()` delegates to context when none provided, eliminating parallel resolution. Committed in `5597884` and `3b48a69`.

### Slice 6. Remove mandatory app-edited bootstrap files from scaffolds — Completed

Once high-level bootstrap exists, reduce scaffolded runtime files to one of these patterns:

- fully framework-owned default bootstrap
- generated thin wrappers that app authors rarely touch

The goal is that a new Teleforge app does not start with runtime files that look central to application development if those files are only framework plumbing.

**Status**: Generated `apps/bot/src/index.ts` reduced from ~300 lines to ~10 lines calling `startTeleforgeBot()`. Generated `apps/bot/src/runtime.ts` reduced from ~120 lines to ~15 lines exporting only `createDevBotRuntime()` as thin simulator bridge. README updated to de-emphasize `runtime.ts`. Committed in `3b48a69`.

### Slice 7. Fold common trusted flows into top-level helpers — Completed

Continue moving repeated Telegram/trusted-runtime patterns into flow-native helpers.

Candidates:

- phone share and phone-auth flows
- request-location flows if adopted
- richer return-to-chat variants
- standard onboarding/auth flow transitions

This keeps Telegram behavior aligned with the flow model instead of forcing developers back into lower-level bot APIs for common cases.

**Status**: `requestLocationAction()` added as flow-native helper mirroring `requestPhoneAction()`. Full runtime wiring: `TelegramLocation` type, `createLocationRequestButton`, `extractSharedLocation`, location middleware in bot runtime, validation rules, and 5 tests. Committed in `1f5a2fb`.

### Slice 8. Strengthen doctor coverage for bootstrap assumptions — Completed for default path

As Teleforge owns more runtime bootstrap, `teleforge doctor` should validate:

- runtime mode consistency
- required secrets for enabled features
- server hooks availability when flows require them
- phone-auth configuration when `requestPhoneAuthAction()` is used
- webhook viability when webhook mode is enabled

This keeps the simpler DX defensible by catching convention failures early.

**Status**: `runtime_secrets` check validates `TELEFORGE_FLOW_SECRET`, `MINI_APP_URL`, and `PHONE_AUTH_SECRET` (usage-tied). `webhook_mode` check validates webhook config completeness but warns that live webhook bootstrap is not yet implemented in the high-level path. Committed in `dfbb008`.

### Slice 9. Documentation cutover — Completed

Once the higher-level runtime APIs are real:

- update Getting Started to use the new bootstrap path
- update reference apps
- reduce emphasis on manual runtime construction
- reposition low-level bootstrap APIs as escape hatches rather than the normal first step

The primary docs should teach the default framework-owned runtime path.

**Status**: Updated Getting Started, Deployment, Framework Model, Flow Coordination, Config Reference, Developer Guide, and Troubleshooting to teach `startTeleforgeBot()` as default path and `createDiscoveredBotRuntime()` as escape hatch. Added `runtime` section to Config Reference. Fixed webhook readiness accuracy and server wiring examples in follow-up. Committed in `5f2001b` and `6f1f7f1`.

## Proposed Public API Direction

### Default path

```ts
import { startTeleforgeBot, startTeleforgeServer } from "teleforge";

await startTeleforgeBot();
await startTeleforgeServer();
```

or a single app-runtime bootstrap when appropriate:

```ts
import { startTeleforgeApp } from "teleforge";

await startTeleforgeApp();
```

### Escape hatch path

Keep lower-level APIs for advanced cases:

- `createDiscoveredBotRuntime()`
- `createDiscoveredServerHooksHandler()`
- lower-level `teleforge/bot` primitives

This keeps the framework operable for non-standard deployments without forcing every user into the low-level model.

## Risks

### 1. Hiding too much too early

If Teleforge absorbs runtime bootstrap too aggressively, advanced users may lose confidence that the framework remains adaptable.

Mitigation:

- keep lower-level APIs
- document escape hatches clearly
- implement high-level bootstrap as wrappers over existing proven runtime pieces

### 2. Overloading config

If `teleforge.config.ts` absorbs too many unrelated deployment details, it can become difficult to understand.

Mitigation:

- keep runtime config focused on framework-owned decisions
- avoid pushing arbitrary hosting concerns into the app config

### 3. Tight coupling between CLI and runtime internals

As the CLI owns more runtime bootstrap, the internal interface between CLI and runtime becomes more important.

Mitigation:

- centralize shared runtime context construction
- keep public runtime helpers testable without the full CLI

## Immediate Next Steps

Recommended next implementation order:

1. add a high-level bot bootstrap API
2. add a high-level hooks server bootstrap API
3. introduce `teleforge start`
4. move scaffold defaults to the new bootstrap path
5. expand doctor coverage for the new convention-driven runtime
6. update docs and examples to teach the new default path

This order gives the biggest developer-experience gain first: removing explicit runtime assembly from normal app setup.

## Definition of Done

This DX plan is complete when a standard Teleforge app can be built and run by primarily editing:

- `teleforge.config.ts`
- flow files
- screen files
- optional server-hook files

and the framework owns the common runtime bootstrap path by default.
