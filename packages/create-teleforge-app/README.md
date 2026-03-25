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
- root workspace scripts for `teleforge dev`, `teleforge dev:https`, and `teleforge doctor`

## Verification

```bash
npm test
```
