# Teleforge Workspace

[![Developer Docs](https://img.shields.io/badge/Docs-Developer_Guide-blue)](./docs/developer-guide.md)

Product OS execution workspace for the Teleforge V1 toolchain.

## Getting Started

If you are new to the repo, start here:

- [Telegram Mini App Basics](./docs/telegram-basics.md)
- [Getting Started](./docs/getting-started.md)
- [Developer Guide](./docs/developer-guide.md)
- [Build Your First Feature](./docs/first-feature.md)
- [Flow Coordination](./docs/flow-coordination.md)
- [BFF Mode Guide](./docs/bff-guide.md)
- [Testing](./docs/testing.md)
- [Deployment](./docs/deployment.md)
- [Environment Variables](./docs/environment-variables.md)
- [Architecture](./docs/architecture.md)
- [Manifest Reference](./docs/manifest-reference.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [Documentation Index](./docs/README.md)

## Packages

- `packages/core`: manifest schema, validation, launch parsing, events, and flow-state primitives
- `packages/bot`: command routing, WebApp data handling, and webhook helpers
- `packages/bff`: Telegram-aware BFF routes, adapters, context, and session/auth helpers
- `packages/create-teleforge-app`: DX-002 scaffold generator
- `packages/devtools`: `teleforge dev`, `teleforge mock`, and `teleforge doctor`
- `packages/ui`: Telegram-native React UI components
- `packages/web`: React hooks and Telegram WebApp types for Mini Apps

## Common Commands

```bash
pnpm install
pnpm docs:build
pnpm build
pnpm test
```

## Production Release

Teleforge release versioning is managed with Changesets, but package publishing is intentionally limited to the framework packages:

- `@teleforge/core`
- `@teleforge/web`
- `@teleforge/ui`
- `@teleforge/bot`
- `@teleforge/bff`
- `@teleforge/devtools`

The repository release workflow lives in [`.github/workflows/release.yml`](./.github/workflows/release.yml). On `main`, it:

1. installs dependencies
2. runs `pnpm build`
3. runs `pnpm test`
4. runs `pnpm run publish:dry-run`
5. uses Changesets to open the release PR or publish unpublished framework packages sequentially

Local release commands:

```bash
pnpm run version
pnpm run publish:dry-run
pnpm run publish
```

Notes:

- `pnpm run publish` uses [`scripts/release-publish.mjs`](./scripts/release-publish.mjs), not raw `changeset publish`
- the publish script skips versions that already exist on npm and does not attempt to publish example apps or the generator
- CI still needs npm credentials configured outside the repo, typically `NPM_TOKEN` with bypass-2FA publishing enabled, or an equivalent trusted publishing setup
- release commits should not include unrelated local-only files such as app-specific `.env` edits

## Documentation

```bash
pnpm docs:build
pnpm docs:serve
```

Narrative docs live in [`docs/`](./docs/README.md).

Generated API reference is rebuilt into `docs/api/` on demand and linked from the documentation index.
It covers the current `@teleforge/core`, `web`, `bot`, `bff`, `ui`, and `devtools` public surfaces.

## Tooling Surface

### Scaffolding

```bash
pnpm --filter create-teleforge-app build
node packages/create-teleforge-app/dist/cli.js my-app --mode spa
node packages/create-teleforge-app/dist/cli.js my-bff-app --mode bff
```

### DevTools

```bash
node packages/devtools/dist/cli.js dev
node packages/devtools/dist/cli.js dev --public --live
node packages/devtools/dist/cli.js mock
node packages/devtools/dist/cli.js doctor
```

`teleforge dev` is the primary local workflow and now opens a Telegram simulator with chat plus an embedded Mini App. Add `--public --live` for Telegram-facing local testing; Cloudflare Tunnel is the default provider. `teleforge dev:https` remains as a legacy alias.

### Web Hooks

```ts
import { useTelegram, useTheme } from "@teleforge/web";
```

`useTelegram` exposes the typed Telegram WebApp SDK with SSR-safe defaults, reactive viewport/theme state, and mock detection. `useTheme` derives Telegram-friendly convenience colors and `--tg-theme-*` CSS variables for UI components.

## Notes

- Workspace dependencies are managed with `pnpm`.
- Generated fixture apps under `generated/` are local verification assets and are not tracked in git.
- Package build outputs stay untracked; use `pnpm build` to regenerate `dist/`.
