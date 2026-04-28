# Teleforge Config Reference

## `teleforge.config.ts`

The root config file exports a Teleforge app configuration via `export default defineTeleforgeApp({...})`.

```ts
import { defineTeleforgeApp } from "teleforge";

export default defineTeleforgeApp({
  app: {
    id: "my-app",
    name: "My App",
    version: "1.0.0"
  },
  bot: {
    tokenEnv: "BOT_TOKEN",
    username: "MyAppBot",
    webhook: {
      path: "/api/webhook",
      secretEnv: "WEBHOOK_SECRET"
    }
  },
  miniApp: {
    entry: "apps/web/src/main.tsx",
    screensRoot: "apps/web/src/screens",
    launchModes: ["inline", "compact", "fullscreen"],
    defaultMode: "compact",
    capabilities: []
  },
  flows: {
    root: "apps/bot/src/flows"
  },
  runtime: {
    server: { port: 3100 },
    phoneAuth: { secretEnv: "PHONE_AUTH_SECRET" }
  }
});
```

### `TeleforgeAppConfig`

| Field | Type | Required | Description |
|---|---|---|---|
| `app` | `TeleforgeAppIdentity` | Yes | App identity (id, name, version) |
| `bot` | `TeleforgeBotConfig` | Yes | Bot username, token env var, webhook config |
| `miniApp` | `TeleforgeMiniAppConfig` | Yes | Mini App entry, screens root, launch modes |
| `flows` | `TeleforgeFlowConventions` | No | Flow discovery paths |
| `routes` | `RouteDefinition[]` | No | Additional route definitions |
| `runtime` | `TeleforgeRuntime` | No | Runtime delivery mode, ports, secrets |
| `permissions` | `TeleforgePermission[]` | No | App capability declarations |
| `features` | Object | No | Feature flags (backButton, cloudStorage, etc.) |
| `security` | Object | No | Security settings (allowedOrigins, etc.) |

---

## `defineFlow()`

Flow definitions live in `apps/bot/src/flows/*.flow.ts`. Each file exports a flow
definition via `export default defineFlow({...})`.

### Action-first flow (default)

```ts
import { defineFlow } from "teleforge";

export default defineFlow({
  id: "my-flow",

  command: {
    command: "start",
    description: "Start the flow",
    handler: async ({ ctx, sign, services }) => {
      const launch = await sign({
        flowId: "my-flow",
        screenId: "home",
        allowedActions: ["submitForm", "cancel"]
      });

      await ctx.reply("Welcome! Tap below to continue.", {
        reply_markup: {
          inline_keyboard: [[
            { text: "Open Mini App", web_app: { url: launch } }
          ]]
        }
      });
    }
  },

  handlers: {
    onContact: async ({ ctx, shared, sign, services }) => {
      const launch = await sign({
        flowId: "my-flow",
        screenId: "profile",
        subject: { phone: shared.normalizedPhone },
        allowedActions: ["editProfile"]
      });

      await ctx.reply("Phone verified. Continue in the Mini App.", {
        reply_markup: {
          inline_keyboard: [[
            { text: "Open Profile", web_app: { url: launch } }
          ]]
        }
      });
    },

    onLocation: async ({ ctx, location, sign, services }) => {
      const launch = await sign({
        flowId: "my-flow",
        screenId: "nearby",
        subject: { lat: location.latitude, lng: location.longitude },
        allowedActions: ["viewResult"]
      });

      await ctx.reply("Location received. Opening nearby results.");
    }
  },

  miniApp: {
    routes: {
      "/": "home",
      "/form": "form",
      "/confirm": "confirm"
    },
    defaultRoute: "/",
    title: "My Flow",
    launchModes: ["inline", "compact", "fullscreen"],
    requestWriteAccess: true
  },

  actions: {
    submitForm: {
      handler: async ({ ctx, data, services }) => {
        await services.database.save(data);
        return {
          navigate: "confirm",
          data: { saved: true }
        };
      }
    },

    cancel: {
      handler: async () => {
        return {
          showHandoff: "Returning to chat...",
          closeMiniApp: true,
          effects: [{ type: "chatMessage", text: "Action cancelled." }]
        };
      }
    }
  }
});
```

### `ActionFlowDefinition`

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Unique flow identifier |
| `command` | `ActionFlowCommandDefinition` | No | Bot slash command registration |
| `handlers` | `ActionFlowHandlers` | No | Bot event handlers (onContact, onLocation, etc.) |
| `miniApp` | `ActionFlowMiniAppDefinition` | No | Mini App route/screen mapping |
| `actions` | `Record<string, ActionFlowActionDefinition>` | No | Server-side action handlers |
| `session` | `ActionFlowSessionDefinition` | No | Opt-in session state configuration |

### `command`

```ts
interface ActionFlowCommandDefinition {
  command: string;        // Slash command, e.g. "start"
  description: string;    // Shown in bot command menu
  handler: (ctx: ActionFlowCommandHandlerContext) => Promise<void>;
}

interface ActionFlowCommandHandlerContext {
  ctx: UpdateContext;           // Bot update context (bot, chat, user, reply)
  sign: SignContextFn;          // Create signed action context tokens
  services: unknown;            // App services container
  session?: SessionHandle;      // Only when session.enabled
}
```

### `handlers`

```ts
interface ActionFlowHandlers {
  onContact?: (ctx: ActionFlowContactHandlerContext) => Promise<void>;
  onLocation?: (ctx: ActionFlowLocationHandlerContext) => Promise<void>;
  onCallback?: (ctx: ActionFlowCallbackHandlerContext) => Promise<void>;
  onWebAppData?: (ctx: ActionFlowWebAppDataHandlerContext) => Promise<void>;
}

interface ActionFlowContactHandlerContext {
  ctx: UpdateContext;           // Bot update context
  shared: {                     // Validated phone contact
    normalizedPhone: string;
    phoneNumber: string;
    telegramUserId: number;
  };
  sign: SignContextFn;
  services: unknown;
}

interface ActionFlowLocationHandlerContext {
  ctx: UpdateContext;           // Bot update context
  location: {                   // Shared location
    latitude: number;
    longitude: number;
    horizontalAccuracy?: number;
  };
  sign: SignContextFn;
  services: unknown;
}
```

**Collision rules:**
- Only one flow may define an `onContact` handler across all flows.
- Only one flow may define an `onLocation` handler across all flows.
- Duplicate `command` names across flows cause a registration error.

### `miniApp`

```ts
interface ActionFlowMiniAppDefinition {
  routes: Record<string, string>;   // URL path → screenId
  defaultRoute?: string;            // Fallback route
  title?: string;                   // Mini App header title
  launchModes?: LaunchMode[];       // Allowed launch modes
  requestWriteAccess?: boolean;     // Request tg write access
}
```

The `routes` map binds URL paths to screen IDs. The first matching route (by
pathname) determines which screen renders. Routes may include path parameters:

```ts
routes: {
  "/": "catalog",
  "/product/:productId": "product.detail",
  "/cart": "cart"
}
```

### `actions`

```ts
interface ActionFlowActionDefinition {
  handler: (ctx: ActionFlowActionHandlerContext) => Promise<ActionResult>;
  requiresSession?: boolean;   // Load session before handler
}

interface ActionFlowActionHandlerContext {
  ctx: ActionContextToken;     // Verified signed context
  data: unknown;               // Payload from Mini App
  services: unknown;
  session?: SessionHandle;     // Only when requiresSession or session.enabled
}
```

Action handlers return an `ActionResult`:

```ts
interface ActionResult {
  data?: Record<string, unknown>;    // Data returned to Mini App
  navigate?: string;                 // Navigate to screenId or route
  closeMiniApp?: boolean;            // Close the Mini App
  showHandoff?: string | boolean;    // Show handoff message, close after delay
  effects?: ActionEffect[];          // Side effects
}

type ActionEffect =
  | { type: "chatMessage"; text: string; chatId?: string }
  | { type: "openMiniApp"; launchUrl: string }
  | { type: "navigate"; screenId: string; params?: Record<string, unknown> }
  | { type: "webhook"; url: string; payload: unknown }
  | { type: "custom"; kind: string; payload: unknown };
```

### `session` (optional)

```ts
interface ActionFlowSessionDefinition {
  enabled: true;                         // Must be explicitly true
  ttlSeconds?: number;                   // Session expiry (default 900s)
  initialState?: Record<string, unknown>; // Initial session state
}
```

Sessions are opt-in. Only flows that declare `session.enabled = true` create
server-side session state. Session state is small, scoped, and TTL-bound.

---

## `defineScreen()`

```ts
import { defineScreen } from "teleforge";

export default defineScreen({
  id: "home",
  title: "Home",
  component: HomeScreen
});
```

### `TeleforgeScreenDefinition`

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Unique screen identifier (matches route map) |
| `component` | `ComponentType<TeleforgeScreenComponentProps>` | Yes | React component |
| `title` | `string` | No | Screen title |
| `guard` | `(ctx) => Promise<boolean \| { allow: false; reason?: string }>` | No | Client-side access guard |
| `loader` | `(ctx) => Promise<TLoaderData>` | No | Client-side data loader |

### Screen component props

```ts
interface TeleforgeScreenComponentProps {
  data?: unknown;                         // Merged launchData + routeData (preferred)
  launchData?: Record<string, unknown>;   // Raw signed context subject
  routeData?: Record<string, unknown>;    // Raw navigate() data
  loaderData?: unknown;                   // Server-loaded screen data
  appState?: MiniAppState;                // Cross-screen client state (React context)
  session?: unknown;                      // Session state (only for session flows)
  screenId: string;                       // Current screen identifier
  routePath: string;                      // Current URL pathname
  transitioning: boolean;                 // Action in progress
  runAction: (actionId: string, payload?: unknown) => Promise<ActionResult>;
  navigate: (screenIdOrRoute: string, options?: NavigateOptions) => void;
}

type NavigateOptions = {
  params?: Record<string, string>;        // Route params (fills :param segments)
  data?: Record<string, unknown>;         // Data passed to next screen
  replace?: boolean;                      // Replace history entry instead of push
};
```

Use `data` for all screen data — the runtime merges signed context and
navigation data automatically. `launchData` and `routeData` are available
for advanced cases that need the raw sources.

---

## `defineTeleforgeApp()`

```ts
import { defineTeleforgeApp } from "teleforge";
import type { TeleforgeAppConfig } from "teleforge";

export default defineTeleforgeApp<TeleforgeAppConfig>({
  app: { id: "my-app", name: "My App", version: "1.0.0" },
  bot: { tokenEnv: "BOT_TOKEN", username: "MyAppBot" },
  miniApp: { entry: "apps/web/src/main.tsx", launchModes: ["compact"], defaultMode: "compact" },
  runtime: { bot: { delivery: "polling" }, server: { port: 3100 } }
});
```

---

## Signed Action Context

Every Mini App action carries a signed context token (prefix `tfp2`). The token
is HMAC-SHA256 signed and contains:

```ts
interface ActionContextToken {
  appId: string;
  flowId: string;
  screenId?: string;
  userId: string;
  subject?: Record<string, unknown>;
  allowedActions?: string[];
  issuedAt: number;
  expiresAt: number;
  nonce?: string;
}
```

The server validates the token on every action request: signature, expiry, and
that the requested action is in `allowedActions`.

### `sign()` context function

Available in command and handler contexts:

```ts
type SignContextFn = (params: {
  flowId: string;
  screenId: string;
  subject?: Record<string, unknown>;
  allowedActions?: string[];
}) => Promise<string>;  // Returns signed token string ready for tgWebAppStartParam
```

---

## Server (`startTeleforgeServer`)

```ts
import { startTeleforgeServer } from "teleforge";

const { url, port, stop } = await startTeleforgeServer({
  flowSecret: process.env.TELEFORGE_FLOW_SECRET,
  port: 3100,
  onChatHandoff: async ({ message, context }) => {
    await bot.sendMessage(context.userId, message);
  }
});
```

### Server endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/teleforge/actions` | POST | Action execution hub (`runAction`, `loadScreenContext`, `handoff`) |

### Request shapes

```ts
// runAction
{ kind: "runAction", input: { flowId, actionId, signedContext, payload? } }

// loadScreenContext
{ kind: "loadScreenContext", input: { flowId, screenId, signedContext } }

// handoff
{ kind: "handoff", input: { signedContext, message } }
```

---

## Bot (`startTeleforgeBot`)

```ts
import { startTeleforgeBot } from "teleforge";

const { runtime, stop } = await startTeleforgeBot({
  flowSecret: process.env.TELEFORGE_FLOW_SECRET,
  miniAppUrl: process.env.MINI_APP_URL,
  token: process.env.BOT_TOKEN
});
```

### Runtime lifecycle

1. Flows are discovered from `apps/bot/src/flows/*.flow.ts`
2. Commands, contact handlers, location handlers, callbacks, and web_app_data handlers are registered from flow definitions
3. Action registry is built (`flowId:actionId` → handler)
4. Route registry is built (URL path → `{ flowId, screenId }`)

---

## Discovery Conventions

| Artifact | Pattern | Loader |
|---|---|---|
| Flows | `{root}/*.flow.{ts,mjs,js}` | `loadTeleforgeFlows` |
| Screens | `{screensRoot}/*.screen.{tsx,ts,jsx,js}` | `loadTeleforgeScreens` |
| App config | `teleforge.config.{ts,mts,js,mjs}` | `loadTeleforgeApp` |

The `flows.root` default is `"flows"`, resolved relative to the project root as
`apps/bot/src/flows`. Configure via `flows.root` in `teleforge.config.ts`.

---

## Client Manifest

A stripped, client-safe manifest is generated for the Mini App bundle.

```ts
interface ClientFlowManifest {
  flows: readonly Array<{
    id: string;
    miniApp?: {
      routes: Record<string, string>;
      defaultRoute?: string;
      title?: string;
    };
    screens: readonly Array<{
      id: string;
      route?: string;
      title?: string;
      actions?: readonly string[];
      requiresSession?: boolean;
    }>;
  }>;
}
```

Generate via:

```ts
import { createClientFlowManifest } from "teleforge";

const manifest = createClientFlowManifest(flows, screens);
```

---

## Flow Authoring Helpers

### `resolveFlowAction(actionId: string): string`

Normalizes an action ID string. Replaces the old `resolveFlowActionKey`.

---

## Migration from step-machine flows

| Old API | New API |
|---|---|
| `defineFlow({ steps, initialStep, finalStep, state })` | `defineFlow({ id, command?, handlers?, miniApp?, actions?, session? })` |
| `chatStep(message, actions)` | Define in `command.handler` or `handlers.onContact` |
| `miniAppStep(screen, { onSubmit })` | Define in `miniApp.routes` + `actions` |
| `openMiniAppAction(label, to)` | `ctx.reply(...)` with `web_app` button + signed URL |
| `requestPhoneAction(label, to)` | `ctx.reply(...)` with `requestContact` button + `onContact` handler |
| `requestLocationAction(label, to)` | `ctx.reply(...)` with `requestLocation` button + `onLocation` handler |
| `returnToChatAction(label, to)` | `return { showHandoff: true, closeMiniApp: true }` in action handler |
| `FlowTransitionResult { state, to }` | `ActionResult { data, navigate, effects }` |
| `UserFlowStateManager` | `SessionManager` (session flows only) |
| `advanceStep(key, step, state)` | Not needed; actions are stateless by default |
| Server hooks `flow-hooks/{flowId}/{stepId}.ts` | Actions defined inline in flow or server |
| `miniApp.stepRoutes` | `miniApp.routes` |
| Screen props `{ flow, state, stepId, submit }` | Screen props `{ launchData, routeData, appState, runAction, navigate }` |
