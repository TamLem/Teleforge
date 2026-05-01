# Teleforge 0.5 Fresh Release Publication Plan

Status: temporary planning document.

Release target: `0.5.0`.

## Fixed Decisions

- This is a fresh release line. Do not preserve compatibility with previous public package layouts.
- App authors install one framework package: `teleforge`.
- App authors scaffold through the framework CLI: `teleforge create`.
- Do not require users to install or understand `@teleforgex/*` implementation packages.
- Do not publish `@teleforgex/core`, `@teleforgex/bot`, `@teleforgex/web`, or `@teleforgex/devtools` as separate public release artifacts for this release.
- Do not publish `create-teleforge-app` separately. It remains an internal scaffold generator used by `teleforge create`.
- Keep internal package folders only if they remain useful as monorepo source/build organization.
- Release docs should describe the current 0.5 model only. No migration or deprecation guidance is needed.

## Current Release Status

- `teleforge` has been made self-contained from npm's point of view.
- Runtime dependencies on `@teleforgex/*` have been removed from the published `teleforge` package metadata.
- The release script publishes only `teleforge`.
- The scaffold is exposed through `teleforge create`.
- Session deployment safety is included in 0.5: runtime environment/topology is explicit, memory sessions are limited to non-production single-process use, and doctor validates the same rules.
- GitHub release notes are drafted in `.github/releases/v0.5.0.md`.
- Remaining work before publish is final verification, repository metadata update in GitHub, tag creation, and npm publish.

## Desired Public Artifacts

Publish:

- `teleforge@0.5.0`

Do not publish:

- `@teleforgex/core`
- `@teleforgex/bot`
- `@teleforgex/web`
- `@teleforgex/devtools`
- `@teleforgex/ui`
- `create-teleforge-app`

## Phase 1: Package Topology

Goal: `teleforge` installs and runs without separately published internal packages.

Required implementation:

- [x] Update `packages/teleforge` build/package setup so runtime output does not depend on unresolved `@teleforgex/*` packages.
- [x] Bundle or internalize `@teleforgex/core`, `@teleforgex/bot`, `@teleforgex/web`, and `@teleforgex/devtools` into the `teleforge` published artifact.
- [x] Remove `@teleforgex/*` runtime dependencies from `packages/teleforge/package.json`.
- [x] Keep `react` as a peer dependency.
- [x] Keep `tsx` only if the published CLI/runtime still needs it.
- [x] Verify public subpath exports still work:
  - `teleforge`
  - `teleforge/web`
  - `teleforge/bot`
  - `teleforge/core/browser`
  - `teleforge/server-hooks`
  - `teleforge/test`
- [x] Verify the `teleforge` binary still dispatches:
  - `teleforge create`
  - `teleforge dev`
  - `teleforge doctor`
  - `teleforge generate client-manifest`
  - `teleforge start`

Acceptance checks:

```bash
pnpm --filter teleforge build
rg '@teleforgex/' packages/teleforge/dist
npm pack --dry-run --workspace packages/teleforge
```

Expected result: no runtime-blocking `@teleforgex/*` imports remain in the packed `teleforge` artifact.

## Phase 2: Version And Dependency Metadata

Goal: release metadata consistently says `0.5.0`.

Update:

- [x] `packages/teleforge/package.json` version to `0.5.0`.
- [x] `packages/create-teleforge-app/package.json` version to `0.5.0` for internal workspace consistency.
- [x] Internal package versions set to `0.5.0` for repository consistency, but they are not public publish artifacts.
- [x] Update internal `workspace:0.2.0` references.
- [x] Update scaffold template dependency:

```ts
teleforge: "^0.5.0"
```

- Update package lock after metadata changes.

Acceptance checks:

```bash
rg '0\.2\.0|0\.1\.1|workspace:0\.2\.0|\^0\.2\.0' package.json packages pnpm-lock.yaml
```

Remaining hits must be intentional third-party dependency or test references only.

## Phase 3: Scaffold Release Readiness

Goal: generated apps start from the 0.5 public model.

Required implementation:

- [x] Generated apps depend on `teleforge@^0.5.0`.
- [x] Generated code imports only public `teleforge` surfaces.
- [x] Generated code must not import `@teleforgex/*`.
- [x] Generated README says `0.5`, not `0.2`.
- [x] Scaffold is exposed through `teleforge create`.
- [x] `create-teleforge-app` is private/internal.
- [x] Keep the current minimal scaffold direction:
  - one flow
  - one screen
  - one action
  - one loader
  - generated contracts
  - default polling mode
  - no webhook/env noise
  - no legacy step-machine language
- [x] Generated config includes explicit `runtime.environment` and `runtime.deployment.topology`.
- [x] Generated `.env.example` includes `TELEFORGE_ENV=development`.

Acceptance checks:

```bash
pnpm --filter teleforge build
node packages/teleforge/dist/cli.cjs create smoke-app --yes --link "$PWD"
cd /tmp/.../smoke-app
pnpm install
pnpm run generate
pnpm run typecheck
pnpm test
pnpm run build
pnpm run doctor
```

Doctor with copied placeholder `.env` may fail on missing real `BOT_TOKEN`; doctor with supplied live-mode env must pass.

## Phase 4: Repository Publication Readiness

Goal: the GitHub repo presents Teleforge as a usable public framework.

Required updates:

- [x] Root `README.md`
  - lead with product value and quick start
  - show `teleforge create my-app`
  - show `pnpm add teleforge` for existing apps
  - describe `teleforge` as the public package
  - describe internal packages as implementation details only
  - remove or lower references to unpublished internal packages
- [x] `packages/teleforge/README.md`
  - update examples to current action/loader/input APIs
  - remove stale `handler: async ({ data })` examples
  - make the scaffold path the primary path
- [x] `packages/create-teleforge-app/README.md`
  - mark as internal generator
  - point public usage to `teleforge create`
- [x] Docs index and getting started
  - ensure first path is scaffold -> generated contracts -> runtime wiring
  - no migration/deprecation section for older APIs
- [ ] GitHub repo metadata
  - description: TypeScript framework for Telegram-native bots and Mini Apps
  - topics: `telegram`, `mini-app`, `bot`, `typescript`, `framework`
  - homepage: published docs URL
  - default branch ready
  - LICENSE present

Local metadata status:

- [x] Root `LICENSE` is present.
- [x] Root package metadata points at `https://tamlem.github.io/Teleforge/`.
- [x] Root package repository points at `https://github.com/TamLem/Teleforge`.
- [x] `teleforge` package metadata points at the same docs homepage and GitHub repository.
- [ ] GitHub repository description/topics/homepage still need to be set on GitHub.

Acceptance checks:

```bash
rg '0\.2 Teleforge|0\.2 action|0\.2-style|Old \(0\.1|deprecated|migration' README.md docs packages/teleforge packages/create-teleforge-app
rg '@teleforgex/(core|bot|web|devtools)' README.md docs packages/teleforge/README.md packages/create-teleforge-app/README.md
rg 'npm create teleforge-app|create-teleforge-app@latest' README.md docs packages/teleforge/README.md packages/create-teleforge-app/README.md
```

Remaining hits must be intentional low-level adapter references.

## Phase 5: Release Notes

Goal: GitHub and npm users understand what 0.5 contains.

Create release notes for `v0.5.0` covering:

- action-first flow model
- signed Mini App launch context
- server-backed screen loaders
- explicit screen runtime props
- typed generated contracts:
  - navigation helpers
  - action helpers
  - loader data
  - sign helpers
- session resource helpers
- session deployment safety:
  - explicit `runtime.environment`
  - explicit `runtime.deployment.topology`
  - memory sessions limited to non-production single-process runtime
  - durable custom providers required for production, split-process, serverless, and multi-instance deployments
- `teleforge doctor`
- modern `teleforge create`
- local development workflow
- one public framework package

No migration notes required.

Release notes policy:

- Package-level changelogs are intentionally not maintained for this fresh single-package release.
- Use GitHub release notes as the public release narrative.

Status:

- [x] Draft created at `.github/releases/v0.5.0.md`.

## Phase 6: Verification Matrix

Run before publishing:

```bash
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
pnpm docs:build
```

Run release-specific checks:

```bash
pnpm --filter teleforge build
npm pack --dry-run --workspace packages/teleforge
pnpm run publish:dry-run
```

Run session deployment safety checks:

```bash
rg -n "BOT_TOKEN.*production|production.*BOT_TOKEN|token.*production|production.*token" packages apps docs -g '*.{ts,tsx,md,mjs}' -g '!packages/teleforge/dist-dts/**'
rg -n "runtime:.*environment|deployment:.*topology|TELEFORGE_ENV" packages apps docs
```

Expected result:

- no source/docs imply bot token presence decides production/session safety
- scaffold and Task Shop expose explicit environment/topology config
- doctor reports session provider errors from environment/topology, not bot token presence

Run install smoke from packed artifacts:

```bash
npm pack --workspace packages/teleforge
```

Then in a temp directory:

```bash
npm install /path/to/teleforge-0.5.0.tgz
node -e "import('teleforge').then(() => console.log('ok'))"
node -e "import('teleforge/web').then(() => console.log('ok'))"
node -e "import('teleforge/bot').then(() => console.log('ok'))"
node -e "import('teleforge/core/browser').then(() => console.log('ok'))"
```

## Phase 7: Publish

Prerequisites:

- clean git worktree
- release commit merged to release branch
- tag name decided: `v0.5.0`
- npm auth available
- package dry-runs clean
- GitHub release notes ready
- use `.github/releases/v0.5.0.md` as the release body

Publish order:

1. Publish `teleforge@0.5.0`.
2. Create git tag `v0.5.0`.
3. Push tag.
4. Create GitHub release from the prepared release notes.
5. Verify install commands from a clean external directory:

```bash
npm exec teleforge@latest -- create my-app
cd my-app
pnpm install
pnpm run generate
pnpm run typecheck
pnpm test
```

## Open Questions

- Should `@teleforgex/ui` remain private/internal-only for this release? Answer: yes.
- Should internal package folders keep independent package names after 0.5? Answer: keep only as monorepo implementation details.
- Should release automation use Changesets or the custom `scripts/release-publish.mjs`? Answer: use the custom script for the single public artifact.

## Local Verification Completed

- `pnpm --filter teleforge build` passes.
- `pnpm docs:build` passes.
- `pnpm run publish:dry-run` publishes only `teleforge@0.5.0` in dry-run mode.
- Session deployment topology validation has been implemented for runtime and doctor:
  - missing provider on session-enabled flows is an error
  - memory provider with production environment is an error
  - memory provider with split/serverless/multi-instance topology is an error
  - custom provider is valid for deployment topologies
  - bot token presence is not used as the production signal
- Packed `teleforge` metadata has no `@teleforgex/*`, `workspace:`, or `create-teleforge-app` runtime references.
- `packages/teleforge/dist/**` has no `@teleforgex/*` runtime references.
- GitHub release note draft exists at `.github/releases/v0.5.0.md`.
- Packed install smoke passes for:
  - `teleforge`
  - `teleforge/web`
  - `teleforge/bot`
  - `teleforge/core/browser`
  - `teleforge/server-hooks`
  - `teleforge/test`
- `teleforge create` smoke generated a 0.5 app through the built CLI.
- Generated scaffold checks pass:
  - `pnpm install --prefer-offline`
  - `pnpm run generate`
  - `pnpm run typecheck`
  - `pnpm test`
  - `pnpm run build`
  - `pnpm run doctor` with live-mode placeholder env values
- Default scaffold doctor correctly reports missing real `BOT_TOKEN` when `.env` still contains placeholder values.
- Temporary smoke directories, tarballs, ignored generated output, and empty untracked directories were cleaned.
