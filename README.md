# Teleforge

Teleforge is a TypeScript framework for Telegram-native products that combine bot chat, Mini Apps,
action handlers, local simulation, and optional server-side session state.

## Quick Start

Create a new Teleforge app:

```bash
npm create teleforge-app@latest my-app
cd my-app
pnpm install
pnpm run generate
pnpm run dev
```

Or add Teleforge to an existing project:

```bash
pnpm add teleforge
```

This README is the top-level navigation page for the framework.

## Start Here

- [Documentation Index](./docs/README.md): full framework documentation map
- [Telegram Mini App Basics](./docs/telegram-basics.md): Telegram concepts before writing Teleforge code
- [Getting Started](./docs/getting-started.md): shortest path to a working app
- [Developer Guide](./docs/developer-guide.md): daily workflow for scaffolded apps
- [Framework Model](./docs/framework-model.md): action-first authoring model and public imports

## Build An App

- [Build Your First Feature](./docs/first-feature.md): add a command, Mini App route, and action handler
- [Flow Coordination](./docs/flow-coordination.md): chat to Mini App to chat lifecycle
- [Action Server](./docs/server-hooks.md): trusted server-side action execution
- [Shared Phone Auth](./docs/shared-phone-auth.md): bot contact sharing with `onContact` handler
- [Testing](./docs/testing.md): bot, web, integration, and scaffold test patterns

## Operate An App

- [Deployment](./docs/deployment.md): production build, polling vs webhook
- [Environment Variables](./docs/environment-variables.md): runtime and devtools environment reference
- [Troubleshooting](./docs/troubleshooting.md): common local-dev, route, manifest, and hook failures
- [Config Reference](./docs/config-reference.md): `teleforge.config.ts`, flows, and action-first API reference

## Examples

- [Starter App](./examples/starter-app/README.md): smallest runnable example
- [Task Shop](./apps/task-shop/README.md): larger reference app

## Public Package

Application authors install one package:

```bash
pnpm add teleforge
```

Use these public import surfaces:

- `teleforge`: app config, flow definitions, discovered runtimes, and action server
- `teleforge/web`: Mini App runtime hooks, `defineScreen()`, and `TeleforgeMiniApp`
- `teleforge/bot`: lower-level bot primitives when direct bot control is needed
- `teleforge/core/browser`: browser-safe launch and validation helpers

Internal workspace packages under `packages/*` implement the framework. They are not the app authoring model.

## Default App Shape

A Teleforge app normally has:

- `teleforge.config.ts`: app identity, bot settings, Mini App entry, and discovery roots
- `apps/bot/src/flows/*.flow.ts`: flow definitions with commands, handlers, routes, and actions
- `apps/web/src/screens/*.screen.tsx`: Mini App screen modules

## Local Commands

```bash
teleforge dev
teleforge dev --public --live
teleforge start
teleforge doctor
teleforge generate client-manifest
```

## Workspace Packages

- `packages/teleforge`: unified public package and CLI entry
- `packages/core`: internal shared contracts, action context signing, session storage, launch parsing
- `packages/bot`: internal Telegram bot routing and chat primitives
- `packages/web`: internal Mini App hooks and Telegram WebApp integration
- `packages/ui`: internal UI primitives
- `packages/devtools`: internal CLI implementation for `teleforge dev`, `teleforge doctor`
- `packages/create-teleforge-app`: scaffold generator

## Release

Versioning uses Changesets. Publishing is driven by `scripts/release-publish.mjs`.

```bash
pnpm run version
pnpm run publish:dry-run
NPM_TOKEN=your_npm_token pnpm run publish
```
