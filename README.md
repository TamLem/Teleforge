# Teleforge Workspace

Product OS execution workspace for the Teleforge V1 toolchain.

## Packages

- `packages/create-teleforge-app`: DX-002 scaffold generator
- `packages/devtools`: `teleforge dev`, `teleforge dev:https`, `teleforge mock`, and `teleforge doctor`
- `packages/web`: React hooks and Telegram WebApp types for Mini Apps

## Common Commands

```bash
pnpm install
pnpm build
pnpm test
```

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
node packages/devtools/dist/cli.js dev:https
node packages/devtools/dist/cli.js mock
node packages/devtools/dist/cli.js doctor
```

### Web Hooks

```ts
import { useTelegram, useTheme } from "@teleforge/web";
```

`useTelegram` exposes the typed Telegram WebApp SDK with SSR-safe defaults, reactive viewport/theme state, and mock detection. `useTheme` derives Telegram-friendly convenience colors and `--tg-theme-*` CSS variables for UI components.

## Notes

- Workspace dependencies are managed with `pnpm`.
- Generated fixture apps under `generated/` are local verification assets and are not tracked in git.
- Package build outputs stay untracked; use `pnpm build` to regenerate `dist/`.
