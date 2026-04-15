# Local Development with Teleforge Source Linking

When developing against a local clone of the Teleforge monorepo, you can **source-link** your bot project so that edits to teleforge packages are picked up immediately — no rebuild step required.

## Quick Start

```bash
# Scaffold a new project linked to your local teleforge clone
create-teleforge-app my-bot --link ../tmf

cd my-bot
pnpm install
```

That's it. The generated `package.json` uses pnpm's `link:` protocol:

```json
{
  "dependencies": {
    "@teleforgex/core": "link:../tmf/packages/core",
    "@teleforgex/bot": "link:../tmf/packages/bot",
    "@teleforgex/ui": "link:../tmf/packages/ui",
    "@teleforgex/web": "link:../tmf/packages/web"
  },
  "devDependencies": {
    "@teleforgex/devtools": "link:../tmf/packages/devtools"
  }
}
```

## How It Works

1. **`link:` protocol** — pnpm creates symlinks from `node_modules/@teleforgex/*` to the local teleforge package directories.
2. **`tsx` runtime** — the starter app uses `tsx` which runs TypeScript directly, so linked source files are loaded without a build step.
3. **IDE support** — VS Code resolves types through the symlinks, giving you go-to-definition into teleforge source.

## Development Workflow

```bash
# Terminal 1: Run your bot with teleforge dev
cd my-bot
pnpm run dev

# Terminal 2: Edit teleforge source — changes are picked up on next run
cd ../tmf
# edit packages/core/src/... or packages/bot/src/...
```

No rebuild needed. Just restart your dev server (or rely on `tsx watch` / `vite` hot reload).

## Reverting to Registry Versions

To unlink and use published versions instead:

1. Edit `package.json` — replace `link:../tmf/packages/*` with version ranges:
   ```json
   {
     "dependencies": {
       "@teleforgex/core": "^0.1.0",
       "@teleforgex/bot": "^0.1.0",
       "@teleforgex/ui": "^0.1.0",
       "@teleforgex/web": "^0.1.0"
     },
     "devDependencies": {
       "@teleforgex/devtools": "^0.1.0"
     }
   }
   ```
2. Run `pnpm install` to restore registry packages.

## Linking an Existing Project

If you already have a bot project and want to link it to local teleforge:

1. Edit `package.json` — change each `@teleforgex/*` dependency to use `link:` pointing to your teleforge clone:
   ```json
   "@teleforgex/core": "link:../tmf/packages/core"
   ```
2. Run `pnpm install`.

## Requirements

- **Node.js >= 18**
- **pnpm**
- A local clone of the [Teleforge monorepo](https://github.com/TamLem/Teleforge)
