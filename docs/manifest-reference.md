# Teleforge Manifest Reference

This document describes the current `teleforge.app.json` schema used by Teleforge V1.

It is based on the actual manifest schema implemented in:

- [`packages/core/src/manifest/schema.ts`](../packages/core/src/manifest/schema.ts)
- [`packages/core/src/manifest/types.ts`](../packages/core/src/manifest/types.ts)

If you need the short version, start with [Getting Started](./getting-started.md). If you need the broader system model, read [Architecture](./architecture.md).

## Purpose

`teleforge.app.json` is the source of truth for:

- runtime mode
- web framework selection
- bot metadata
- Mini App capabilities
- route declarations
- local dev behavior

It is consumed by:

- the scaffold generator
- `@teleforge/core` manifest validation
- `@teleforge/devtools`
- app code that derives route behavior from the manifest

## Top-Level Schema

The current top-level fields are:

| Field         | Type            | Required | Purpose                               |
| ------------- | --------------- | -------- | ------------------------------------- |
| `$schema`     | `string` URL    | no       | optional schema URL for editors/tools |
| `id`          | `string`        | yes      | kebab-case app identifier             |
| `name`        | `string`        | yes      | human-readable app name               |
| `version`     | `string` semver | yes      | manifest/app version                  |
| `runtime`     | object          | yes      | runtime mode and framework wiring     |
| `bot`         | object          | yes      | Telegram bot metadata                 |
| `miniApp`     | object          | yes      | Mini App runtime metadata             |
| `routes`      | array           | yes      | route declarations                    |
| `build`       | object          | no       | top-level build settings              |
| `dev`         | object          | no       | local dev preferences                 |
| `features`    | object          | no       | feature capability flags              |
| `permissions` | array           | no       | declared app permissions              |
| `security`    | object          | no       | validation/origin settings            |

There is no top-level `bff.adapters[]` section in the current manifest schema. BFF adapters are configured in `@teleforge/bff` code, not in `teleforge.app.json`.

## `id`

Type:

```ts
string;
```

Rules:

- must be kebab-case
- used as the canonical app identifier

Example:

```json
{
  "id": "starter-app"
}
```

## `name`

Type:

```ts
string;
```

Rules:

- required
- human-readable display name

Example:

```json
{
  "name": "Starter App"
}
```

## `version`

Type:

```ts
string;
```

Rules:

- must be valid semver

Example:

```json
{
  "version": "1.0.0"
}
```

## `runtime`

Type:

```ts
{
  apiPrefix?: string;
  apiRoutes?: string;
  build?: {
    basePath?: string;
    outDir?: string;
  };
  mode: "spa" | "bff";
  ssr?: boolean;
  webFramework: "vite" | "nextjs" | "custom";
}
```

Purpose:

- tells Teleforge whether the app is SPA- or BFF-oriented
- selects the web framework shape used by the app

Rules enforced by the schema:

- `runtime.mode: "spa"` requires `runtime.webFramework: "vite"`
- `runtime.mode: "bff"` requires `runtime.webFramework: "nextjs"` or `"custom"`

Common fields:

- `mode`: choose `spa` or `bff`
- `webFramework`: actual web runtime
- `apiPrefix`: optional API prefix for app endpoints
- `apiRoutes`: optional path to API routes for BFF-style apps
- `build.basePath`: optional public base path
- `build.outDir`: optional build output directory
- `ssr`: optional runtime SSR hint

Example:

```json
{
  "runtime": {
    "mode": "spa",
    "webFramework": "vite",
    "build": {
      "outDir": "dist",
      "basePath": "/"
    }
  }
}
```

## `bot`

Type:

```ts
{
  commands?: Array<{
    command: string;
    description?: string;
    handler?: string;
  }>;
  tokenEnv: string;
  username: string;
  webhook: {
    path: string;
    secretEnv: string;
  };
}
```

Purpose:

- declares the Telegram bot identity and expected environment-variable wiring

Fields:

- `username`: BotFather username
- `tokenEnv`: env var name that contains the bot token
- `webhook.path`: webhook endpoint path
- `webhook.secretEnv`: env var name for the webhook secret
- `commands[]`: optional command metadata used by the app/bot runtime

Example:

```json
{
  "bot": {
    "username": "starter_app_bot",
    "tokenEnv": "BOT_TOKEN",
    "webhook": {
      "path": "/api/webhook",
      "secretEnv": "WEBHOOK_SECRET"
    },
    "commands": [
      {
        "command": "start",
        "description": "Open the Starter App",
        "handler": "commands/start"
      }
    ]
  }
}
```

### `bot.commands[].handler`

The `handler` string is a **convention and metadata field**, not an automatic module loader.

In the scaffold and repo examples, a value such as:

```json
"handler": "commands/start"
```

maps by convention to:

- `apps/bot/src/commands/start.ts`

You still import and register that command in your bot runtime yourself. In other words:

- the manifest declares intended structure
- your runtime code performs the actual registration
- the scaffold follows the same naming convention so the mapping stays obvious

## `miniApp`

Type:

```ts
{
  capabilities: string[];
  defaultMode: "inline" | "compact" | "fullscreen";
  entryPoint: string;
  launchModes: Array<"inline" | "compact" | "fullscreen">;
  url?: string;
}
```

Purpose:

- describes the web entry point and the global launch/capability envelope for the Mini App

Fields:

- `entryPoint`: app web entry file
- `launchModes`: supported Telegram launch modes
- `defaultMode`: default launch mode
- `capabilities`: supported app capabilities such as `read_access`, `write_access`, `payments`
- `url`: optional public Mini App URL

Rules:

- `defaultMode` must be present in `launchModes`

Example:

```json
{
  "miniApp": {
    "entryPoint": "apps/web/src/main.tsx",
    "launchModes": ["inline", "compact", "fullscreen"],
    "defaultMode": "inline",
    "capabilities": ["read_access", "write_access"]
  }
}
```

## `routes`

Type:

```ts
Array<RouteDefinition>;
```

Each route entry describes one addressable Mini App route.

Fields:

| Field          | Type       | Purpose                              |
| -------------- | ---------- | ------------------------------------ |
| `path`         | `string`   | route path, must start with `/`      |
| `component`    | `string`   | app component/module reference       |
| `title`        | `string`   | route title                          |
| `description`  | `string`   | route description                    |
| `launchModes`  | `string[]` | allowed launch modes for this route  |
| `guards`       | `string[]` | route-level guard labels             |
| `capabilities` | object     | route capability requirements        |
| `coordination` | object     | chat/Mini App coordination metadata  |
| `meta`         | object     | extra route metadata                 |
| `ui`           | object     | route-level header/Main Button hints |

### `routes[].component`

Like bot handlers, the `component` string is a **convention and metadata field** in current Teleforge V1.

In the scaffold and repo examples:

- `component: "App"` conventionally maps to `apps/web/src/App.tsx`
- `component: "pages/Home"` conventionally maps to `apps/web/src/pages/Home.tsx`
- `component: "pages/CheckoutPage"` conventionally maps to `apps/web/src/pages/CheckoutPage.tsx`

Teleforge does not auto-import these modules from the manifest today. Instead:

- your app code performs the actual routing and imports
- `teleforge doctor` uses the convention to verify that the referenced component file exists under `apps/web/src`

That is why the manifest is still valuable even when the runtime wiring is manual: it remains the source of truth for route intent, launch-mode metadata, and expected file layout.

### `routes[].capabilities`

Type:

```ts
{
  auth?: boolean;
  launchMode?: "inline" | "compact" | "fullscreen";
  payments?: boolean;
}
```

Use this for explicit route requirements such as:

- authenticated access
- payments requirement
- a required launch mode

### `routes[].coordination`

Type:

```ts
{
  entryPoints: Array<
    | { type: "miniapp"; startParam?: string }
    | { command: string; type: "bot_command" }
    | { text: string; type: "bot_button" }
    | { type: "deep_link"; url: string }
  >;
  flow?: {
    entryStep: string;
    flowId: string;
    requestWriteAccess?: boolean;
  };
  returnToChat?: {
    stayInChat?: boolean;
    text: string;
  };
}
```

Use coordination when a route participates in a chat-driven flow.

### `routes[].ui`

Type:

```ts
{
  header?: {
    hideBackButton?: boolean;
    title?: string;
  };
  mainButton?: {
    text: string;
    visible?: boolean;
  };
}
```

Use this for route-level UI hints that app code can interpret.

### Route Example

```json
{
  "path": "/checkout",
  "component": "pages/CheckoutPage",
  "launchModes": ["compact", "fullscreen"],
  "title": "Checkout",
  "guards": ["auth"],
  "capabilities": {
    "auth": true,
    "launchMode": "compact",
    "payments": true
  }
}
```

## `build`

Type:

```ts
{
  outDir?: string;
  publicDir?: string;
}
```

Purpose:

- top-level build hints for the app workspace

Example:

```json
{
  "build": {
    "outDir": "dist",
    "publicDir": "public"
  }
}
```

## `dev`

Type:

```ts
{
  httpsPort?: number;
  port?: number;
  tunnel?: boolean;
}
```

Purpose:

- local development preferences used by Teleforge devtools

Fields:

- `port`: preferred local dev port
- `httpsPort`: preferred HTTPS dev port
- `tunnel`: whether local tunneling is preferred

## `features`

Type:

```ts
{
  backButton?: boolean;
  cloudStorage?: boolean;
  hapticFeedback?: boolean;
  payments?: boolean;
  settingsButton?: boolean;
}
```

Purpose:

- declares app feature expectations for Telegram-native surfaces

## `permissions`

Type:

```ts
Array<{
  capability?: string;
  description?: string;
  scope?: string;
}>;
```

Rules:

- each entry must declare at least `capability` or `scope`

Example:

```json
{
  "permissions": [
    {
      "capability": "write_access",
      "description": "Send order confirmations through the bot"
    }
  ]
}
```

## `security`

Type:

```ts
{
  allowedOrigins?: string[];
  validateInitData?: boolean;
  webhookSecret?: string;
}
```

Purpose:

- optional security-related settings for validation and origin control

Fields:

- `allowedOrigins`: accepted origin list
- `validateInitData`: whether validation is expected
- `webhookSecret`: optional webhook-secret value

## Complete Example Manifest

The following example uses only fields that exist in the current schema.

```jsonc
{
  "$schema": "https://teleforge.dev/schemas/app-manifest.json",
  "id": "sample-app",
  "name": "Sample App",
  "version": "1.0.0",

  // Choose SPA or BFF mode and a compatible web framework.
  "runtime": {
    "mode": "spa",
    "webFramework": "vite",
    "build": {
      "outDir": "dist",
      "basePath": "/"
    }
  },

  // Bot metadata and env-var wiring.
  "bot": {
    "username": "sample_app_bot",
    "tokenEnv": "BOT_TOKEN",
    "webhook": {
      "path": "/api/webhook",
      "secretEnv": "WEBHOOK_SECRET"
    },
    "commands": [
      {
        "command": "start",
        "description": "Open the Sample App",
        "handler": "commands/start"
      }
    ]
  },

  // Global Mini App runtime envelope.
  "miniApp": {
    "entryPoint": "apps/web/src/main.tsx",
    "launchModes": ["inline", "compact", "fullscreen"],
    "defaultMode": "inline",
    "capabilities": ["read_access", "write_access"]
  },

  // Route definitions used by app code and route guards.
  "routes": [
    {
      "path": "/",
      "component": "pages/HomePage",
      "launchModes": ["inline", "compact", "fullscreen"],
      "title": "Home"
    },
    {
      "path": "/checkout",
      "component": "pages/CheckoutPage",
      "launchModes": ["compact", "fullscreen"],
      "title": "Checkout",
      "guards": ["auth"],
      "capabilities": {
        "auth": true,
        "launchMode": "compact",
        "payments": true
      },
      "coordination": {
        "entryPoints": [
          {
            "type": "bot_command",
            "command": "/start"
          }
        ],
        "flow": {
          "flowId": "checkout",
          "entryStep": "cart"
        },
        "returnToChat": {
          "text": "Your order is ready.",
          "stayInChat": true
        }
      }
    }
  ],

  "permissions": [
    {
      "capability": "write_access",
      "description": "Allow the bot to send confirmations"
    }
  ],

  "features": {
    "backButton": true,
    "payments": true
  },

  "dev": {
    "port": 3000,
    "httpsPort": 3443,
    "tunnel": true
  }
}
```

## Validation Notes

Common manifest validation failures:

- `runtime.mode: "spa"` with anything other than `webFramework: "vite"`
- `runtime.mode: "bff"` with `webFramework: "vite"`
- `miniApp.defaultMode` not present in `miniApp.launchModes`
- route paths that do not start with `/`
- permission entries with neither `capability` nor `scope`

For local diagnosis, use:

```bash
teleforge doctor
```

For schema or launch-mode issues, see [Troubleshooting](./troubleshooting.md).
