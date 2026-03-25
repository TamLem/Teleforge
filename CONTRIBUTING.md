# Contributing to Teleforge

Thanks for contributing to Teleforge. This repository contains the framework packages, developer tooling, and sample application used to validate the V1 release.

## Development Setup

```bash
pnpm install
pnpm build
pnpm check
```

`pnpm check` is the main contribution gate. It runs linting, formatting, tests, and builds across the framework packages, scaffold generator, and sample app.

## Project Structure

```text
packages/
  core/                  Foundation types, manifest handling, validation, events
  web/                   React hooks and Telegram WebApp integration
  bot/                   Bot routing and Mini App payload handling
  ui/                    Telegram-native UI primitives
  devtools/              Local development CLI and diagnostics
  create-teleforge-app/  Scaffold generator
apps/
  task-shop/             End-to-end sample Mini App + bot workspace
```

## Making Changes

1. Create a branch that reflects the change scope, for example `feat/docs-site` or `fix/web-hook-cleanup`.
2. Keep changes scoped. If a task touches multiple packages, explain why in the PR description.
3. Add or update tests for behavioral changes.
4. Update docs when public APIs, commands, or workflows change.
5. Run `pnpm check` before opening a PR.

## Code Style

- TypeScript is strict by default.
- Formatting is enforced with Prettier and the repository uses double quotes.
- ESLint enforces the shared quality rules across packages and the sample app.
- Generated output such as `dist/` and `docs/api/` should not be edited manually.

## Testing

```bash
pnpm test
pnpm --filter @teleforge/core test
pnpm --filter @teleforge/web test
pnpm --dir apps/task-shop test
pnpm --dir apps/task-shop test:integration
```

The repository primarily uses Node's built-in test runner plus integration tests in `apps/task-shop`.

## Documentation

Update the relevant docs when you change public behavior:

- package `README.md` files for install or usage changes
- JSDoc comments for public APIs
- `docs/api/` via `pnpm docs:build`
- `apps/task-shop/docs/INTEGRATION_AUDIT.md` when integration behavior changes

## Commit and PR Guidance

- Prefer conventional commit prefixes such as `feat:`, `fix:`, `docs:`, `refactor:`, or `chore:`.
- Keep each PR focused on one concern.
- Fill out the PR template completely.
- Add a changeset when the change affects a published package release.

## Security

Do not include real bot tokens, webhook secrets, or production credentials in commits, fixtures, screenshots, or test output. See [SECURITY.md](./SECURITY.md) for the vulnerability reporting policy.

## Community Standards

Please follow the expectations in [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md). If you are unsure whether something belongs in an issue, a docs update, or a feature proposal, start with the issue templates under [`.github/ISSUE_TEMPLATE/`](./.github/ISSUE_TEMPLATE/).
