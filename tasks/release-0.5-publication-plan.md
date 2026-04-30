# Teleforge 0.5 Fresh Release Publication Plan

Status: temporary planning document.

Release target: `0.5.0`.

## Fixed Decisions

- This is a fresh release line. Do not preserve compatibility with previous public package layouts.
- App authors install one framework package: `teleforge`.
- App authors scaffold with `create-teleforge-app`.
- Do not require users to install or understand `@teleforgex/*` implementation packages.
- Do not publish `@teleforgex/core`, `@teleforgex/bot`, `@teleforgex/web`, or `@teleforgex/devtools` as separate public release artifacts for this release.
- Keep internal package folders only if they remain useful as monorepo source/build organization.
- Release docs should describe the current 0.5 model only. No migration or deprecation guidance is needed.

## Current Release Blocker

The current built `teleforge` package still imports internal workspace packages:

- `@teleforgex/core`
- `@teleforgex/bot`
- `@teleforgex/web`
- `@teleforgex/devtools`

That means `teleforge` is not yet installable as a standalone npm package unless those internals are published separately. Since the release decision is a single public framework package, the implementation must make `teleforge` self-contained from npm's point of view.

Release cannot proceed until `packages/teleforge/dist/**` has no unresolved runtime imports from `@teleforgex/*`.

## Desired Public Artifacts

Publish:

- `teleforge@0.5.0`
- `create-teleforge-app@0.5.0`

Do not publish:

- `@teleforgex/core`
- `@teleforgex/bot`
- `@teleforgex/web`
- `@teleforgex/devtools`
- `@teleforgex/ui`

## Phase 1: Package Topology

Goal: `teleforge` installs and runs without separately published internal packages.

Required implementation:

- Update `packages/teleforge` build/package setup so runtime output does not depend on unresolved `@teleforgex/*` packages.
- Bundle or internalize `@teleforgex/core`, `@teleforgex/bot`, `@teleforgex/web`, and `@teleforgex/devtools` into the `teleforge` published artifact.
- Remove `@teleforgex/*` runtime dependencies from `packages/teleforge/package.json`.
- Keep `react` as a peer dependency.
- Keep `tsx` only if the published CLI/runtime still needs it.
- Verify public subpath exports still work:
  - `teleforge`
  - `teleforge/web`
  - `teleforge/bot`
  - `teleforge/core/browser`
  - `teleforge/server-hooks`
  - `teleforge/test`
- Verify the `teleforge` binary still dispatches:
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

- `packages/teleforge/package.json` version to `0.5.0`.
- `packages/create-teleforge-app/package.json` version to `0.5.0`.
- Internal package versions may be set to `0.5.0` for repository consistency, but they must not be required public publish artifacts.
- Update internal `workspace:0.2.0` references if kept.
- Update scaffold template dependency:

```ts
teleforge: "^0.5.0"
```

- Update package lock after metadata changes.

Acceptance checks:

```bash
rg '0\.2\.0|0\.1\.1|workspace:0\.2\.0|\^0\.2\.0' package.json packages pnpm-lock.yaml
```

Remaining hits must be intentional historical changelog/test references only.

## Phase 3: Scaffold Release Readiness

Goal: generated apps start from the 0.5 public model.

Required implementation:

- Generated apps depend on `teleforge@^0.5.0`.
- Generated code imports only public `teleforge` surfaces.
- Generated code must not import `@teleforgex/*`.
- Generated README says `0.5`, not `0.2`.
- Keep the current minimal scaffold direction:
  - one flow
  - one screen
  - one action
  - one loader
  - generated contracts
  - default polling mode
  - no webhook/env noise
  - no legacy step-machine language

Acceptance checks:

```bash
pnpm --filter create-teleforge-app build
node packages/create-teleforge-app/dist/cli.js smoke-app --yes --link "$PWD"
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

- Root `README.md`
  - lead with product value and quick start
  - show `npm create teleforge-app@latest my-app`
  - show `pnpm add teleforge` for existing apps
  - describe `teleforge` as the public package
  - describe internal packages as implementation details only
  - remove or lower references to unpublished internal packages
- `packages/teleforge/README.md`
  - update examples to current action/loader/input APIs
  - remove stale `handler: async ({ data })` examples
  - make the scaffold path the primary path
- `packages/create-teleforge-app/README.md`
  - update to 0.5
  - confirm CLI flags match current implementation
- Docs index and getting started
  - ensure first path is scaffold -> generated contracts -> runtime wiring
  - no migration/deprecation section for older APIs
- GitHub repo metadata
  - description: TypeScript framework for Telegram-native bots and Mini Apps
  - topics: `telegram`, `mini-app`, `bot`, `typescript`, `framework`
  - homepage: published docs URL
  - default branch ready
  - LICENSE present

Acceptance checks:

```bash
rg '0\.2 Teleforge|0\.2 action|0\.2-style|Old \(0\.1|deprecated|migration' README.md docs packages/teleforge packages/create-teleforge-app
rg '@teleforgex/(core|bot|web|devtools)' README.md docs packages/teleforge/README.md packages/create-teleforge-app/README.md
```

Remaining hits must be intentional low-level adapter or historical changelog references.

## Phase 5: Release Notes And Changelog

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
- `teleforge doctor`
- modern `create-teleforge-app`
- local simulator/dev workflow
- one public framework package

No migration notes required.

Update changelogs:

- `packages/teleforge/CHANGELOG.md`
- `packages/create-teleforge-app/CHANGELOG.md` if created
- optionally root release notes file if we want a repo-level source for GitHub release copy

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
pnpm --filter create-teleforge-app build
npm pack --dry-run --workspace packages/teleforge
npm pack --dry-run --workspace packages/create-teleforge-app
pnpm run publish:dry-run
```

Run install smoke from packed artifacts:

```bash
npm pack --workspace packages/teleforge
npm pack --workspace packages/create-teleforge-app
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

Publish order:

1. Publish `teleforge@0.5.0`.
2. Publish `create-teleforge-app@0.5.0`.
3. Create git tag `v0.5.0`.
4. Push tag.
5. Create GitHub release from the prepared release notes.
6. Verify install commands from a clean external directory:

```bash
npm create teleforge-app@latest my-app
cd my-app
pnpm install
pnpm run generate
pnpm run typecheck
pnpm test
```

## Open Questions

- Should `@teleforgex/ui` remain private/internal-only for this release? Recommendation: yes.
- Should internal package folders keep independent package names after 0.5? Recommendation: keep only if useful for monorepo development; do not expose them in public docs.
- Should release automation use Changesets or the custom `scripts/release-publish.mjs`? Recommendation: use the custom script for the two public artifacts after adjusting it to the single-package release model.
