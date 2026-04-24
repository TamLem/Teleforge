# Teleforge

Teleforge is a TypeScript framework for Telegram-native products that combine bot chat, Mini Apps, flow state, local simulation, and optional trusted server hooks.

This repository README is the top-level navigation page. Start here, then use the docs that match what you are trying to do.

## Start Here

- [Documentation Index](./docs/README.md): full framework documentation map
- [Telegram Mini App Basics](./docs/telegram-basics.md): Telegram concepts before writing Teleforge code
- [Getting Started](./docs/getting-started.md): shortest path to a working app
- [Developer Guide](./docs/developer-guide.md): daily workflow for scaffolded apps and examples
- [Framework Model](./docs/framework-model.md): flow-first authoring model and public imports

## Build An App

- [Build Your First Feature](./docs/first-feature.md): add a command, flow step, and Mini App screen
- [Flow Coordination](./docs/flow-coordination.md): chat to Mini App to chat lifecycle
- [Server Hooks](./docs/server-hooks.md): opt-in trusted backend hooks with `--with-api`
- [Shared Phone Auth](./docs/shared-phone-auth.md): bot contact sharing plus Mini App launch tokens
- [Testing](./docs/testing.md): bot, web, integration, and scaffold test patterns

## Operate An App

- [Deployment](./docs/deployment.md): production build, polling vs webhook, and rollout checklist
- [Environment Variables](./docs/environment-variables.md): runtime and devtools environment reference
- [Troubleshooting](./docs/troubleshooting.md): common local-dev, route, manifest, and hook failures
- [Config Reference](./docs/config-reference.md): `teleforge.config.ts`, discovery roots, and flow config details

## Examples

- [Starter App](./examples/starter-app/README.md): smallest runnable example with one command and one screen
- [Task Shop](./apps/task-shop/README.md): larger reference app with multi-step flows and return-to-chat behavior

## Public Package

Application authors install one package:

```bash
pnpm add teleforge
```

Use these public import surfaces:

- `teleforge`: app config, flow definitions, discovered runtimes, screen helpers, and server-hook helpers
- `teleforge/web`: Mini App runtime hooks, `defineScreen()`, and `TeleforgeMiniApp`
- `teleforge/bot`: lower-level bot primitives when direct bot control is needed
- `teleforge/server-hooks`: server-only flow hook execution
- `teleforge/core/browser`: browser-safe launch and validation helpers

Internal workspace packages under `packages/*` implement the framework. They are not the app authoring model.

## Default App Shape

A Teleforge app normally has:

- `teleforge.config.ts`: app identity, bot settings, Mini App entry, and discovery roots
- `apps/bot/src/flows/*.flow.ts`: flow definitions with chat and Mini App steps
- `apps/web/src/screens/*.screen.tsx`: Mini App screen modules
- optional `apps/api/src/flow-hooks/*`: trusted server hooks generated with `--with-api`

The default scaffold is polling-first and does not generate API/webhook placeholders unless requested.

## Local Commands

For app authors:

```bash
teleforge dev
teleforge dev --public --live
teleforge start
teleforge doctor
teleforge generate client-manifest
teleforge mock
```

For framework contributors:

```bash
pnpm install
pnpm lint
pnpm format
pnpm test
pnpm build
pnpm docs:build
```

Targeted contributor checks:

```bash
pnpm --filter teleforge test
pnpm --filter create-teleforge-app test
cd packages/devtools && pnpm test
pnpm --dir apps/task-shop test
```

## Docs Site

Build the narrative docs and generated API reference:

```bash
pnpm docs:build
```

Open the generated site at `dist/docs-site/index.html`. The API reference is generated into `dist/docs-site/api`.

## Workspace Packages

- `packages/teleforge`: unified public package and CLI entry
- `packages/core`: internal shared contracts, launch parsing, validation, events, and flow-state primitives
- `packages/bot`: internal Telegram bot runtime primitives
- `packages/web`: internal Mini App hooks and Telegram WebApp integration
- `packages/ui`: internal UI primitives
- `packages/devtools`: internal CLI implementation for `teleforge dev`, `teleforge mock`, and `teleforge doctor`
- `packages/create-teleforge-app`: scaffold generator

## Release

Versioning uses Changesets. Publishing is driven by `scripts/release-publish.mjs` and requires an npm token through `--token`, `TELEFORGE_NPM_TOKEN`, `NPM_TOKEN`, or `NODE_AUTH_TOKEN`.

```bash
pnpm run version
pnpm run publish:dry-run
NPM_TOKEN=your_npm_token pnpm run publish
```

Release commits should not include local `.env` files, generated app artifacts, or package build outputs.
