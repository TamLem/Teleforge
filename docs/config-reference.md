# Teleforge Config Reference

`teleforge.config.ts` is the source of truth for a Teleforge app.

It defines app identity, bot metadata, Mini App entry settings, and discovery paths for flows, screens, and server hooks. It does not ask users to choose between separate framework modes.

## Top-Level Example

```ts
import { defineTeleforgeApp } from "teleforge";

export default defineTeleforgeApp({
  app: {
    id: "task-shop",
    name: "Task Shop",
    version: "1.0.0"
  },
  flows: {
    root: "apps/bot/src/flows"
  },
  bot: {
    username: "taskshopbot",
    tokenEnv: "BOT_TOKEN",
    webhook: {
      path: "/api/webhook",
      secretEnv: "WEBHOOK_SECRET"
    }
  },
  miniApp: {
    entry: "apps/web/src/main.tsx",
    route: "/",
    title: "Task Shop",
    launchModes: ["inline", "compact", "fullscreen"],
    defaultMode: "inline"
  }
});
```

## `app`

| Field     | Type     | Purpose                   |
| --------- | -------- | ------------------------- |
| `id`      | `string` | Kebab-case app identifier |
| `name`    | `string` | Human-readable app name   |
| `version` | `string` | App version               |

## `flows`

| Field  | Type     | Purpose                                                         |
| ------ | -------- | --------------------------------------------------------------- |
| `root` | `string` | Directory path for flow discovery, such as `apps/bot/src/flows` |

Flow files are discovered by convention and should export a `defineFlow()` definition.

## `bot`

| Field               | Type     | Purpose                                          |
| ------------------- | -------- | ------------------------------------------------ |
| `username`          | `string` | Telegram bot username without `@`                |
| `tokenEnv`          | `string` | Environment variable name for the bot token      |
| `webhook`           | `object` | Optional webhook configuration                   |
| `webhook.path`      | `string` | Webhook endpoint path, such as `/api/webhook`    |
| `webhook.secretEnv` | `string` | Environment variable for Telegram webhook secret |

Polling and webhook delivery are deployment choices. They are not separate Teleforge product modes.

## `miniApp`

| Field                | Type       | Purpose                                 |
| -------------------- | ---------- | --------------------------------------- |
| `entry`              | `string`   | Path to the Mini App entry file         |
| `route`              | `string`   | Base route for the Mini App             |
| `title`              | `string`   | Mini App title                          |
| `launchModes`        | `string[]` | Allowed Telegram launch modes           |
| `defaultMode`        | `string`   | Default launch mode                     |
| `capabilities`       | `string[]` | Optional required capabilities          |
| `requestWriteAccess` | `boolean`  | Whether to request write access         |
| `returnToChat`       | `object`   | Optional return-to-chat button behavior |

Step-to-screen mapping belongs in flow definitions. App-level Mini App config should stay focused on runtime entry and defaults.

## Flow Definitions

Flows are the main authoring unit:

```ts
import { defineFlow } from "teleforge";

export default defineFlow<FlowState>({
  id: "checkout",
  initialStep: "catalog",
  finalStep: "done",
  state: { cart: [] },
  bot: {
    command: {
      command: "shop",
      description: "Open the shop",
      text: "Choose an item",
      buttonText: "Open shop"
    }
  },
  steps: {
    catalog: {
      type: "miniapp",
      screen: "catalog",
      onSubmit: async ({ data, state }) => ({
        state: { ...state, cart: [data.itemId] },
        to: "review"
      })
    },
    review: {
      type: "miniapp",
      screen: "checkout.review"
    },
    done: {
      type: "chat",
      message: "Order received."
    }
  }
});
```

### Mini App Step

```ts
{
  type: "miniapp",
  screen: "screen-id",
  onSubmit?: async ({ data, state }) => ({ state?, to? }),
  actions?: [{ id, label, to }]
}
```

### Chat Step

```ts
{
  type: "chat",
  message: "Text shown in chat",
  actions?: [{ id, label, to, miniApp?: { payload? } }]
}
```

## Screen Definitions

Screens are the frontend unit bound to Mini App steps:

```tsx
import { defineScreen } from "teleforge/web";

export default defineScreen<FlowState>({
  id: "catalog",
  title: "Catalog",
  loader: async (context) => ({ products: [] }),
  component: CatalogScreen
});
```

Screen components receive flow context, loader data, transition state, and submit/action helpers from the Mini App runtime.

## Discovery Conventions

| Discovery     | Path Pattern                                                   | Export                             |
| ------------- | -------------------------------------------------------------- | ---------------------------------- |
| Flows         | `apps/bot/src/flows/*.flow.{ts,mjs,js}`                        | `export default defineFlow(...)`   |
| Flow handlers | `apps/bot/src/flow-handlers/{flowId}/{stepId}.{ts,mjs,js}`     | `export const actions = { ... }`   |
| Server hooks  | `apps/bot/src/flow-server-hooks/{flowId}/{stepId}.{ts,mjs,js}` | `export const guard?, loader?`     |
| Screens       | `apps/web/src/screens/*.{screen,page}.{tsx,ts}`                | `export default defineScreen(...)` |

## Environment Variables

| Variable                | Purpose                          | Required                    |
| ----------------------- | -------------------------------- | --------------------------- |
| `BOT_TOKEN`             | Telegram bot token               | live Telegram bot runtime   |
| `WEBHOOK_SECRET`        | Webhook verification secret      | webhook deployments         |
| `MINI_APP_URL`          | Public Mini App URL override     | production or public tunnel |
| `TELEFORGE_FLOW_SECRET` | Signing secret for flow contexts | trusted runtime payloads    |

## Read Alongside

- [Framework Model](./framework-model.md)
- [Flow Coordination](./flow-coordination.md)
- [Flow State Architecture](./flow-state-design.md)
- [Mini App Architecture](./miniapp-architecture.md)
