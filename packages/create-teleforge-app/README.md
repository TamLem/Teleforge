# create-teleforge-app

Internal greenfield Teleforge project generator used by `teleforge create`.

This workspace package is not a public release artifact. Public users should scaffold through the `teleforge` CLI:

```bash
pnpm dlx teleforge@latest create my-app
```

## Usage

For local framework development, build `teleforge` and call the bundled create command:

```bash
pnpm --filter teleforge build
node packages/teleforge/dist/cli.cjs create my-app --link "$PWD"
```

Pass `--yes` to skip prompts.

## Generated Output

The scaffold generates a complete 0.5 Teleforge app:

- `apps/web` with Mini App shell, screens, and Vite delivery
- `apps/bot` with discovered flows and bot runtime
- `apps/api` with server loaders
- `packages/types` for shared types
- `teleforge.config.ts` for app configuration

### Key Files

- `apps/bot/src/flows/start.flow.ts` - First flow with `sign()` command and actions
- `apps/api/src/loaders/home.loader.ts` - Server loader example
- `apps/web/src/screens/home.screen.tsx` - Screen with generated contracts
- `apps/web/src/teleforge-contract-overrides.ts` - Typed payload and loader data

## CLI Options

```bash
teleforge create <project-name>  # Generate scaffold
teleforge create <name> --yes     # Skip prompts
teleforge create <name> --link <path>  # Link to local teleforge monorepo
teleforge create <name> --overwrite    # Replace existing directory
```

## Generated Workflow

After generation:

```bash
cd my-app
pnpm install
pnpm run generate  # Creates manifest + contracts
pnpm run dev        # Local Mini App development server
pnpm run doctor     # Validate setup
pnpm test           # Run tests
pnpm run build      # Production build
```

## Recommended Reading

- [Runtime Wiring](https://teleforge.dev/docs/runtime-wiring)
- [State Boundaries](https://teleforge.dev/docs/state-boundaries)  
- [Generated Mini App Contracts](https://teleforge.dev/docs/generated-miniapp-contracts)
- [Server Loaders](https://teleforge.dev/docs/server-hooks)

## Verification

```bash
pnpm test
```
