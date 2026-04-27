# teleforge

Unified TypeScript framework for Telegram-native bots and Mini Apps.

Teleforge lets you describe product journeys as **flows** — bot commands, Mini App screens, and
server-side action handlers — while the framework handles Telegram transport, runtime bootstrap,
and local development.

## What you build

A Teleforge app is primarily:

- `teleforge.config.ts` — app identity, flow discovery, Mini App defaults
- `apps/bot/src/flows/*.flow.ts` — user journeys with commands, contact/location handlers, Mini App routes, and actions
- `apps/web/src/screens/*.screen.tsx` — Mini App screens registered with `defineScreen()`

The framework discovers flows and screens by convention, generates client-safe Mini App metadata,
detects manifest drift in development, and wires the bot runtime, action server, and simulator
automatically.

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
import { defineFlow } from "teleforge";

export default defineFlow({
  id: "start",

  command: {
    command: "start",
    description: "Start the Mini App",
    handler: async ({ ctx, sign }) => {
      const launch = await sign({
        flowId: "start",
        screenId: "home",
        allowedActions: ["navigate"]
      });

      await ctx.reply("Welcome! Open the Mini App to get started.", {
        reply_markup: {
          inline_keyboard: [[
            { text: "Open App", web_app: { url: launch } }
          ]]
        }
      });
    }
  },

  miniApp: {
    routes: { "/": "home" },
    defaultRoute: "/",
    title: "My App"
  },

  actions: {
    navigate: {
      handler: async ({ data }) => ({ navigate: (data as { screenId: string }).screenId })
    }
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
teleforge dev              # Local simulator with chat, Mini App, companion services, and manifest preflight
teleforge start            # Production bootstrap: polling or webhook bot + action server
teleforge doctor           # Environment, manifest drift, and wiring diagnostics
teleforge generate client-manifest   # Manually regenerate client-safe flow metadata
teleforge mock             # Standalone Telegram profile/state server for manual testing
```

## Public import surfaces

| Import path | Purpose |
|---|---|
| `teleforge` | App config (`defineTeleforgeApp`), flow definitions (`defineFlow`), and high-level bootstrap (`startTeleforgeBot`, `startTeleforgeServer`) |
| `teleforge/web` | Mini App shell (`TeleforgeMiniApp`), screen registration (`defineScreen`), and launch coordination hooks |
| `teleforge/bot` | Bot runtime types, command handlers, and lower-level primitives for custom routing |
| `teleforge/test` | Framework test helpers |

## Default path vs escape hatches

**Default path** — framework owns runtime bootstrap:

```ts
// apps/bot/src/index.ts (generated, rarely edited)
import { startTeleforgeBot } from "teleforge";
await startTeleforgeBot();
```

**Escape hatches** for advanced use cases:

- `createDiscoveredBotRuntime()` — lower-level bot runtime with explicit secrets and custom delivery wiring
- `createActionServerHooksHandler()` — manual action server assembly
- `teleforge/bot` primitives — custom command routing, webhook adapters, callback handling

Simple apps should stay on the default path. Advanced apps pay complexity only when needed.

## Documentation

- [Getting Started](https://tamlem.github.io/Teleforge/getting-started.html)
- [Developer Guide](https://tamlem.github.io/Teleforge/developer-guide.html)
- [Config Reference](https://tamlem.github.io/Teleforge/config-reference.html)
- [Deployment](https://tamlem.github.io/Teleforge/deployment.html)

## Requirements

- Node.js 18 or newer (20 LTS recommended)
- pnpm (recommended package manager)

## License

MIT
