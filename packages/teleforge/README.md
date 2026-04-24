# teleforge

Unified TypeScript framework for Telegram-native bots and Mini Apps.

Teleforge lets you describe product journeys as flows — chat steps, Mini App screens, and transitions — while the framework handles Telegram transport, runtime bootstrap, and local development.

## What you build

A Teleforge app is primarily:

- `teleforge.config.ts` — app identity, flow discovery, Mini App defaults
- `apps/bot/src/flows/*.flow.ts` — user journeys with chat steps, Mini App steps, and actions
- `apps/web/src/screens/*.screen.tsx` — Mini App screens registered with `defineScreen()`
- Optional `apps/api/src/flow-hooks/` — trusted server hooks for guards, loaders, submit handlers

The framework discovers flows and screens by convention, generates client-safe Mini App metadata, and wires the bot runtime, server hooks, and simulator automatically.

## Installation

```bash
npm create teleforge-app@latest my-app
cd my-app
pnpm install
```

Or in an existing workspace:

```bash
pnpm add teleforge
```

## Quick start

```ts
// teleforge.config.ts
import { defineTeleforgeApp } from "teleforge";

export default defineTeleforgeApp({
  app: { id: "my-app", name: "My App", version: "1.0.0" },
  flows: { root: "apps/bot/src/flows" },
  bot: { username: "myappbot", tokenEnv: "BOT_TOKEN" },
  miniApp: {
    entry: "apps/web/src/main.tsx",
    launchModes: ["inline", "compact", "fullscreen"],
    defaultMode: "inline"
  }
});
```

```ts
// apps/bot/src/flows/start.flow.ts
import { chatStep, defineFlow, miniAppStep, openMiniAppAction } from "teleforge";

export default defineFlow({
  id: "start",
  initialStep: "welcome",
  state: {},
  bot: { command: { command: "start", text: "Welcome!" } },
  miniApp: { route: "/" },
  steps: {
    welcome: chatStep("Welcome!", [openMiniAppAction("Open app", "home")]),
    home: miniAppStep("home")
  }
});
```

```tsx
// apps/web/src/screens/home.screen.tsx
import { defineScreen } from "teleforge/web";

export default defineScreen({
  id: "home",
  title: "Home",
  component: () => <div>Hello from Teleforge</div>
});
```

## CLI commands

```bash
teleforge dev              # Local simulator with chat, Mini App, and companion services
teleforge start            # Production bootstrap: polling bot + discovered server hooks from config
teleforge doctor           # Environment, manifest, and wiring diagnostics
teleforge generate client-manifest   # Regenerate client-safe flow metadata
teleforge mock             # Standalone mock-state server for CI or manual testing
```

## Public import surfaces

| Import path | Purpose |
|-------------|---------|
| `teleforge` | App config (`defineTeleforgeApp`), flow definitions (`defineFlow`, `chatStep`, `miniAppStep`, action helpers), and high-level bootstrap (`startTeleforgeBot`, `startTeleforgeServer`) |
| `teleforge/web` | Mini App shell (`TeleforgeMiniApp`), screen registration (`defineScreen`), and launch coordination hooks |
| `teleforge/bot` | Bot runtime types, command handlers, and lower-level primitives for custom routing |
| `teleforge/server-hooks` | Trusted server-side load, submit, and action hooks |
| `teleforge/test` | Framework test helpers: `validateDiscoveredWiring`, `createMockWebApp` |

## Default path vs escape hatches

**Default path** — framework owns runtime bootstrap:

```ts
// apps/bot/src/index.ts (generated, rarely edited)
import { startTeleforgeBot } from "teleforge";
await startTeleforgeBot();
```

**Escape hatches** for advanced use cases:

- `createDiscoveredBotRuntime()` — lower-level bot runtime with explicit storage, secrets, and custom delivery wiring
- `createDiscoveredServerHooksHandler()` — manual hooks server assembly
- `teleforge/bot` primitives — custom command routing, webhook adapters, callback handling

Simple apps should stay on the default path. Advanced apps pay complexity only when needed.

## Documentation

- [Getting Started](https://tamlem.github.io/Teleforge/getting-started.html) — fastest path to a working app
- [Developer Guide](https://tamlem.github.io/Teleforge/developer-guide.html) — daily workflow and conventions
- [Config Reference](https://tamlem.github.io/Teleforge/config-reference.html) — `teleforge.config.ts` fields and flow authoring helpers
- [Deployment](https://tamlem.github.io/Teleforge/deployment.html) — production build, polling, and hosting
- [API Reference](https://tamlem.github.io/Teleforge/api/index.html) — TypeDoc generated from public exports

## Requirements

- Node.js 18 or newer (20 LTS recommended)
- pnpm (recommended package manager)

## License

MIT
