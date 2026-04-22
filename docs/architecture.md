# Teleforge Architecture

This document describes the current Teleforge architecture as a unified framework package for Telegram bot and Mini App products.

## High-Level Model

Teleforge has one public authoring model:

```text
teleforge.config.ts
  -> flows
  -> chat steps
  -> Mini App screen steps
  -> optional server hooks
```

Application authors should think in terms of product flows, not separate libraries. Internal packages still exist in this repository, but they are implementation layers behind the unified `teleforge` package.

## Public Runtime Surfaces

The supported public imports are:

- `teleforge`: app config, flow definitions, discovered runtimes, shared flow state helpers
- `teleforge/bot`: lower-level bot primitives when an app needs direct Telegram update handling
- `teleforge/web`: Mini App runtime, screen definitions, Telegram hooks, flow bridge helpers
- `teleforge/ui`: Telegram-aware React UI primitives
- `teleforge/core/browser`: browser-safe launch and validation helpers
- `teleforge/server-hooks`: trusted flow guard, loader, submit, and action bridge helpers

There is no public `teleforge/bff`, `teleforge/core`, or `teleforge/devtools` subpath. Server-side backend work should be modeled as server hooks unless an internal package is being developed directly.

## Internal Layers

The repository still contains internal packages that implement the framework:

- `packages/core`: shared schemas, launch parsing, validation, flow-state storage contracts
- `packages/bot`: Telegram update routing and chat primitives
- `packages/web`: Mini App hooks, flow bridge, and browser runtime helpers
- `packages/ui`: React UI primitives built on top of the web runtime
- `packages/bff`: internal server-side request, identity, and session primitives reused by server hooks
- `packages/devtools`: CLI, local simulator, doctor checks, and tunnel support
- `packages/teleforge`: the unified public package that composes the layers above

These packages are useful for framework maintainers. App documentation should not ask users to assemble them.

## Flow Runtime

A flow owns the product state machine:

- `chat` steps render and progress inside the bot conversation
- `miniapp` steps resolve to registered frontend screens
- submit and action handlers advance the flow
- server hooks can provide trusted guard, loader, submit, and action execution
- `UserFlowStateManager` persists flow instances across surfaces

The flow instance is the authoritative state boundary between bot, Mini App, and server hook execution.

## Bot Runtime

The bot runtime is responsible for:

- loading `teleforge.config.ts`
- discovering flow modules
- registering bot commands from flow metadata
- rendering chat steps
- sending Mini App launch buttons
- accepting `web_app_data` and structured return-to-chat handoffs
- resuming persisted flow instances

Apps normally enter this through `createDiscoveredBotRuntime()` from `teleforge`. Lower-level primitives are available from `teleforge/bot` when a runtime needs custom Telegram routing.

## Mini App Runtime

The Mini App runtime is a screen runtime, not a generic website shell.

It is responsible for:

- bootstrapping Telegram WebApp context
- resolving the active flow instance and step
- loading the registered screen for a Mini App step
- running client-side loaders and bridge calls
- submitting typed payloads back to the flow runtime
- transitioning between Mini App screens without hard reloads where possible
- handing control back to chat when the next flow step is a chat step

Screens are registered with `defineScreen()` from `teleforge/web`. The app shell is normally `TeleforgeMiniApp`.

## Server Hooks

Server hooks are optional trusted runtime endpoints. Use them when the browser cannot be the authority for a flow step.

They are responsible for:

- server-side guard decisions
- trusted loader data
- trusted submit/action handlers
- identity and ownership validation
- domain service calls and durable writes

The public API is `teleforge/server-hooks`. Internal request/session/identity helpers may be implemented in `packages/bff`, but that package is not the product model.

## Config and Discovery

`teleforge.config.ts` drives:

- app identity
- flow discovery root
- bot username and webhook metadata
- Mini App entry and launch defaults
- devtools validation

Discovery conventions connect the surfaces:

- flows: `apps/bot/src/flows/*.flow.ts`
- flow handlers: `apps/bot/src/flow-handlers/{flowId}/{stepId}.ts`
- server hooks: `apps/bot/src/flow-server-hooks/{flowId}/{stepId}.ts`
- screens: `apps/web/src/screens/*.screen.tsx`

Route and launch metadata are derived from flows and screens. App authors should not manually keep a second manifest in sync.

## Local Tooling

The `teleforge` CLI provides:

- `teleforge dev` for local Mini App and simulator development
- `teleforge dev --public --live` for tunnel-backed Telegram testing
- `teleforge mock` for standalone Telegram context simulation
- `teleforge doctor` for config and environment checks

The CLI is shipped through the unified `teleforge` package even though its implementation lives in `packages/devtools`.

## Reference Apps

Use [`examples/starter-app`](../examples/starter-app/README.md) for the smallest working app.

Use [`apps/task-shop`](../apps/task-shop/README.md) for the full reference flow with chat/Mini App coordination, persisted state, server bridge usage, and screen runtime patterns.

## Non-Goals

The current architecture does not claim:

- a generic website framework
- a low-code page builder
- a public split-package assembly model
- a public BFF app mode
- backward compatibility with removed legacy manifest paths
