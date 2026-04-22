# Teleforge

Teleforge is a unified TypeScript framework for Telegram-native products that combine bots, Mini Apps, flow state, local simulation, and optional trusted server hooks.

Start with the [Documentation Index](./docs/README.md), [Getting Started](./docs/getting-started.md), or the [Developer Guide](./docs/developer-guide.md).

## Public Model

Application authors use one package:

```bash
pnpm add teleforge
```

The supported public import surface is:

- `teleforge`: app config, flow definitions, discovered runtimes, screen helpers, and server-hook helpers
- `teleforge/bot`: bot runtime primitives when direct bot control is needed
- `teleforge/web`: Mini App runtime hooks and `TeleforgeMiniApp`
- `teleforge/ui`: Telegram-native React UI components
- `teleforge/core/browser`: browser-safe launch and validation helpers
- `teleforge/server-hooks`: server-only flow hook execution

Internal workspace packages still exist under `packages/*`, but they are implementation layers, not the app authoring model.

## App Shape

A Teleforge app starts from:

- `teleforge.config.ts`: app identity, bot settings, Mini App entry, and discovery roots
- `apps/bot/src/flows/*.flow.ts`: flow definitions with chat and Mini App steps
- `apps/web/src/screens/*.screen.tsx`: Mini App screen modules
- optional `apps/bot/src/flow-handlers` and server-hook modules for trusted work

The local workflow is simulator-first:

```bash
pnpm install
pnpm build
pnpm dev
```

For real Telegram testing:

```bash
teleforge dev --public --live
```

## Workspace Packages

- `packages/teleforge`: unified public package and CLI entry
- `packages/core`: internal shared contracts, launch parsing, validation, events, and flow-state primitives
- `packages/bot`: internal Telegram bot runtime primitives
- `packages/web`: internal Mini App hooks and Telegram WebApp integration
- `packages/ui`: internal UI primitives re-exported through `teleforge/ui`
- `packages/devtools`: internal CLI implementation for `teleforge dev`, `teleforge mock`, and `teleforge doctor`
- `packages/bff`: internal server-side implementation helpers retained while server hooks become the public model
- `packages/create-teleforge-app`: scaffold generator

## Common Commands

```bash
pnpm install
pnpm lint
pnpm format
pnpm test
pnpm build
pnpm docs:build
```

Targeted checks:

```bash
pnpm --filter teleforge test
pnpm --filter create-teleforge-app test
cd packages/devtools && pnpm test
pnpm --dir apps/task-shop test
```

The devtools filter is a framework-repo maintenance command. App authors use the `teleforge` CLI shipped by the unified package.

## Examples

- `examples/starter-app`: minimal flow-first app with one bot command and one Mini App screen
- `apps/task-shop`: larger reference app covering multi-step flows, screen runtime behavior, init data validation, and return-to-chat continuity

## Documentation

```bash
pnpm docs:build
pnpm docs:serve
```

Narrative docs live in [`docs/`](./docs/README.md). The API reference is generated into `dist/docs-site/api`.

## Release

Versioning uses Changesets. Publishing is driven by `scripts/release-publish.mjs` and requires an npm token through `--token`, `TELEFORGE_NPM_TOKEN`, `NPM_TOKEN`, or `NODE_AUTH_TOKEN`.

```bash
pnpm run version
pnpm run publish:dry-run
NPM_TOKEN=your_npm_token pnpm run publish
```

Release commits should not include local `.env` files, generated app artifacts, or package build outputs.
