# create-teleforge-app

Greenfield Teleforge project generator for Product OS task `DX-002`.

## Usage

```bash
npm install
npm run build
node dist/cli.js my-app --mode spa
node dist/cli.js my-bff-app --mode bff
```

Interactive mode is supported when `--mode` or the target directory is omitted.

## Supported Output

- `apps/web` with either Vite (`spa`) or Next.js (`bff`)
- `apps/bot` starter runtime and `start` command handler
- `apps/api` starter routes and webhook placeholder
- `teleforge.app.json`
- `.env.example`
- root workspace scripts for `teleforge dev`, `teleforge dev --public --live`, and `teleforge doctor`

## Generated Workflow

The scaffold is polling-first by default:

- `pnpm run dev`: local simulator with chat, embedded Mini App, fixtures, replay controls, debug panel, and the companion bot process
- `pnpm run dev:public`: public HTTPS tunnel for real Telegram testing
- `pnpm test`: baseline bot and screen smoke tests
- `pnpm run doctor`: manifest and environment diagnostics

Generated apps also export `apps/bot/src/runtime.ts`, so `teleforge dev` can execute `/start`, `web_app_data`, and callback flows directly inside the simulator chat without Telegram.

The generated `apps/api` files are placeholders. They do not make webhook mode active by themselves; webhook mode only makes sense once the primary web runtime actually serves `/api/webhook`.

## Recommended Reading After Generation

Inside this repo, the best follow-on docs are:

- `docs/telegram-basics.md`
- `docs/first-feature.md`
- `docs/testing.md`
- `docs/deployment.md`

## Verification

```bash
npm test
```
