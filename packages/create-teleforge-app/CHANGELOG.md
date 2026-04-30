# create-teleforge-app

## 0.5.0

### Internal Changes

Teleforge 0.5 exposes scaffolding through `teleforge create`. This package remains an internal workspace implementation detail and is not published as a separate public artifact.

#### Generated app structure

- `apps/bot/src/flows/start.flow.ts` — First flow with `sign()` command and actions
- `apps/api/src/loaders/home.loader.ts` — Server loader example
- `apps/web/src/screens/home.screen.tsx` — Screen with generated contracts
- `apps/web/src/teleforge-contract-overrides.ts` — Typed payload and loader data
- `packages/types/src/index.ts` — Shared types (minimal, contracts are generated)
- `teleforge.config.ts` — App configuration

#### CLI options

```bash
teleforge create <project-name>
teleforge create <name> --yes
teleforge create <name> --link <path>
teleforge create <name> --overwrite
```

#### Generated workflow

```bash
cd my-app
pnpm install
pnpm run generate  # Creates manifest + contracts
pnpm run dev        # Local simulator
pnpm run doctor     # Validate setup
pnpm test           # Run tests
pnpm run build      # Production build
```

#### Scaffold principles

- One flow, one screen, one action, one loader
- Generated contracts with full type safety
- Default polling mode (no webhook config)
- Clean `.env.example` without HTTPS noise
- No legacy step-machine concepts
