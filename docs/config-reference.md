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

function schema<T>(s: { safeParse(input: unknown): { success: true; data: T } | { success: false; error: unknown } }) {
  return s;
}

export default defineFlow({
  id: "my-flow",

  session: { enabled: true },

  command: {
    command: "start",
    description: "Start the flow",
    handler: async ({ ctx, sign }) => {
      const launch = await sign({
        screenId: "home",
        subject: {},
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
    onContact: async ({ ctx, shared, sign }) => {
      const launch = await sign({
        screenId: "profile",
        subject: { resource: { type: "phone", value: shared.normalizedPhone } },
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

    onLocation: async ({ ctx, location, sign }) => {
      const launch = await sign({
        screenId: "nearby",
        subject: { resource: { type: "location", lat: location.latitude, lng: location.longitude } },
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
      input: schema<{ formData: string }>({
        safeParse(input) {
          if (typeof input !== "object" || input === null) return { success: false, error: "invalid" };
          return { success: true, data: input as { formData: string } };
        }
      }),
      handler: async ({ input, session, services }) => {
        const saved = await services.database.save(input.formData);
        return { data: { saved: true, id: saved.id } };
      }
    },

    cancel: {
      handler: async () => {
        return {
          data: { cancelled: true },
          handoff: { message: "Returning to chat...", closeMiniApp: true },
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
  command: string;
  description: string;
  handler: (ctx: ActionFlowCommandHandlerContext) => Promise<void>;
}

interface ActionFlowCommandHandlerContext {
  ctx: UpdateContext;
  sign: SignContextFn;
  services: unknown;
  session?: SessionHandle;
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
  ctx: UpdateContext;
  shared: { normalizedPhone: string; phoneNumber: string; telegramUserId: number };
  sign: SignContextFn;
  services: unknown;
}

interface ActionFlowLocationHandlerContext {
  ctx: UpdateContext;
  location: { latitude: number; longitude: number; horizontalAccuracy?: number };
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
  routes: Record<string, string>;
  defaultRoute?: string;
  title?: string;
  launchModes?: LaunchMode[];
  requestWriteAccess?: boolean;
}
```

The `routes` map binds URL paths to screen IDs:

```ts
routes: {
  "/": "catalog",
  "/product/:productId": "productDetail",
  "/cart": "cart"
}
```

### `actions`

```ts
interface ActionFlowActionDefinition<TContext = unknown, TInput = unknown> {
  handler: (ctx: ActionFlowActionHandlerContext<TContext, TInput>) => Promise<ActionResult>;
  input?: TeleforgeInputSchema<TInput>;
  requiresSession?: boolean;
}

interface ActionFlowActionHandlerContext<TContext = unknown, TInput = unknown> {
  ctx: ActionContextToken;
  input: TInput;
  services: unknown;
  session?: SessionHandle;
  sign: SignContextFn;
}
```

Action handlers return an `ActionResult`:

```ts
interface ActionResult {
  data?: Record<string, unknown>;
  handoff?: { message?: string; closeMiniApp?: boolean };
  effects?: ActionEffect[];
  redirect?: { screenId: string; params?: Record<string, string>; data?: Record<string, unknown>; replace?: boolean; reason?: string };
  clientEffects?: ClientEffect[];
}

type ActionEffect =
  | { type: "chatMessage"; text: string; chatId?: string; replyMarkup?: { inline_keyboard?: Array<Array<{ text: string; url?: string; web_app?: { url: string }; callback_data?: string }>> } }
  | { type: "openMiniApp"; launchUrl: string }
  | { type: "navigate"; screenId: string; params?: Record<string, unknown> }
  | { type: "webhook"; url: string; payload: unknown }
  | { type: "custom"; kind: string; payload: unknown };
```

### `session` (optional)

```ts
interface ActionFlowSessionDefinition {
  enabled: true;
  ttlSeconds?: number;
  initialState?: Record<string, unknown>;
}
```

Sessions are opt-in. Only flows that declare `session.enabled = true` create
server-side session state.

---

## `defineLoader()`

Loader files live in the configured loader root (default `apps/api/src/loaders/`).

```ts
import { defineLoader } from "teleforge";

export default defineLoader({
  handler: async ({ ctx, params, services, session }) => {
    return { products: await services.catalog.list() };
  }
});
```

With optional schema validation:

```ts
import { defineLoader } from "teleforge";
import type { TeleforgeInputSchema } from "teleforge";

const input: TeleforgeInputSchema<{ id: string }> = {
  safeParse(input) {
    if (typeof input !== "object" || input === null) return { success: false, error: { message: "invalid" } };
    const obj = input as Record<string, unknown>;
    if (typeof obj.id !== "string") return { success: false, error: { message: "id required" } };
    return { success: true, data: { id: obj.id } };
  }
};

export default defineLoader({
  input,
  handler: async ({ input, ctx, services }) => {
    return { product: await services.catalog.get(input.id, ctx.userId) };
  }
});
```

---

## `defineScreen()`

```ts
import { defineScreen } from "teleforge/web";

export default defineScreen({
  id: "home",
  title: "Home",
  component: HomeScreen
});
```

### `TeleforgeScreenDefinition`

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Unique screen identifier |
| `component` | `ComponentType<TeleforgeScreenComponentProps>` | Yes | React component |
| `title` | `string` | No | Screen title |
| `guard` | `(ctx) => MaybePromise<boolean \| { allow: false; reason?: string }>` | No | Client-side access guard |

### Screen component props (recommended path)

Import generated per-screen prop aliases instead of the broad base type:

```ts
import type { CatalogScreenProps } from "./teleforge-generated/contracts";

function CatalogScreen({ loader, loaderData, actions, nav }: CatalogScreenProps) {
  if (loader.status === "loading") return <div>Loading...</div>;
  const products = loaderData?.products ?? [];
  return (
    <div>
      {products.map((p) => (
        <div key={p.id}>
          <span>{p.name}</span>
          <button onClick={() => actions.addToCart({ productId: p.id, qty: 1 })}>Add</button>
          <button onClick={() => nav.productDetail({ id: p.id })}>Details</button>
        </div>
      ))}
    </div>
  );
}
```

The generated alias narrows `screenId`, `routeParams`, `nav`, `actions`, `loader`, and `loaderData`
to the types declared in `teleforge-contract-overrides.ts`. See [Generated Mini App Contracts](./generated-miniapp-contracts.md)
for the full authoring model.

### Base prop type (runtime reference)

```ts
interface TeleforgeScreenComponentProps {
  scopeData?: Record<string, unknown>;         // Signed context subject (server-issued scope)
  routeParams: Record<string, string>;          // Route params from matched pattern
  routeData?: Record<string, unknown>;          // Ephemeral data from navigate()
  loader: { status: "loading" | "ready" | "error" | "idle"; data?: unknown; error?: Error };
  loaderData?: unknown;                         // loader.data when ready
  appState?: MiniAppState;                      // Client-session state (React context)
  actions: Record<string, (payload?: unknown) => Promise<ActionResult>>;
  nav: Record<string, (params?: Record<string, string>, options?: { data?: Record<string, unknown> }) => void>;
  runAction: (actionId: string, payload?: unknown) => Promise<ActionResult>;
  navigate: (screenIdOrRoute: string, options?: NavigateOptions) => void;
  transitioning: boolean;
  screenId: string;
  routePath: string;
}

type NavigateOptions = {
  params?: Record<string, string>;
  data?: Record<string, unknown>;
  replace?: boolean;
};
```

Use `actions.*` and `nav.*` as the happy path. `runAction` and `navigate` are available
as escape hatches for programmatic access.

### Typed helpers

These generic types power generated contracts:

- `TypedNavigationHelpers<TRoutes>` — nav helpers requiring exact route params
- `TypedActionHelpers<TPayloads>` — action helpers with typed payloads
- `TypedLoaderState<TData>` — discriminated loader lifecycle that narrows `data` when `status === "ready"`
- `TypedSignHelpers<TRoutes>` — sign helpers requiring the same route params as nav

They are exported from `teleforge/web` and consumed by the generated `contracts.ts`.

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

For what `sign()` creates, what should go in `subject`, and how the token travels through the
runtime, see [Runtime Wiring](./runtime-wiring.md).

### `sign()` context function

Available in command and handler contexts:

```ts
type SignContextFn = (params: {
  screenId: string;
  subject?: Record<string, unknown>;
  allowedActions?: string[];
  ttlSeconds?: number;
}) => Promise<string>;  // Returns signed Mini App URL
```

---

## Server (`startTeleforgeServer`)

```ts
import { startTeleforgeServer } from "teleforge";

const { url, port, stop } = await startTeleforgeServer({
  flowSecret: process.env.TELEFORGE_FLOW_SECRET,
  port: 3100,
  onChatHandoff: async ({ message, context, replyMarkup }) => {
    await bot.sendMessage(context.userId, message, { reply_markup: replyMarkup });
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
{ kind: "loadScreenContext", input: { flowId, screenId, signedContext, params? } }

// handoff
{ kind: "handoff", input: { signedContext, message } }
```

For how these request shapes travel through the runtime — from `actions.addToCart()` on the
client to handler execution on the server — see [Runtime Wiring](./runtime-wiring.md).

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

---

## Schema Helpers (`TeleforgeInputSchema`)

Schemas are library-agnostic. Any object with `parse` or `safeParse` works:

```ts
interface TeleforgeSchema<T> {
  parse(input: unknown): T;
}

interface TeleforgeSafeSchema<T> {
  safeParse(input: unknown):
    | { success: true; data: T }
    | { success: false; error: unknown };
}
```

Zod schemas satisfy this interface directly. You can also write inline validators:

```ts
const mySchema: TeleforgeInputSchema<{ id: string }> = {
  safeParse(input) {
    if (typeof input !== "object" || input === null) return { success: false, error: { message: "invalid" } };
    const obj = input as Record<string, unknown>;
    if (typeof obj.id !== "string") return { success: false, error: { message: "id required" } };
    return { success: true, data: { id: obj.id } };
  }
};
```

---

## Session Resources

When `session.enabled` is true, handlers and loaders receive a `SessionHandle`:

```ts
interface SessionHandle<TState = Record<string, unknown>> {
  get(): Promise<TState>;
  patch(partial: Partial<TState>): Promise<void>;
  set(next: TState): Promise<void>;
  complete(): Promise<void>;
  resource<TValue = Record<string, unknown>>(
    key: string,
    options?: { initialValue?: TValue | (() => TValue | Promise<TValue>) }
  ): SessionResourceHandle<TValue>;
}

interface SessionResourceHandle<TValue> {
  get(): Promise<TValue>;
  set(value: TValue): Promise<void>;
  update(mutator: (draft: TValue) => void | TValue | Promise<void | TValue>): Promise<TValue>;
  clear(): Promise<void>;
}
```

Resources are isolated by user and flow. Use for cart state, draft data, and order references.

---

## Client Manifest

The generated client manifest (`apps/web/src/teleforge-generated/client-flow-manifest.ts`)
is the browser-safe boundary. Regenerate after flow changes:

```bash
teleforge generate client-manifest
```

Do not import flow files from the web entry — they may contain server-only handlers.

For how the manifest is used at runtime to resolve routes and construct `actions.*` and `nav.*`,
see [Runtime Wiring](./runtime-wiring.md).
