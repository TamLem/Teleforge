# Flow State Architecture

## Core Model

Teleforge action execution is a **framework-owned runtime** backed by optional session storage.
The bot and action server are **transport adapters** that invoke the same runtime contract.
Neither owns state — they validate signed action context and run handlers.

```text
┌─────────────────────────────────────────────────┐
│              Teleforge Action Runtime           │
│                                                 │
│  ┌──────────┐    ┌──────────┐    ┌───────────┐ │
│  │  Bot     │    │ Action   │    │  Future   │ │
│  │ Adapter  │    │ Server   │    │  Workers  │ │
│  └────┬─────┘    └────┬─────┘    └─────┬─────┘ │
│       │               │               │         │
│       └───────────────┼───────────────┘         │
│                       │                         │
│              ┌────────▼────────┐                │
│              │ Action          │                │
│              │ Registry        │                │
│              └────────┬────────┘                │
│                       │                         │
│        ┌──────────────▼──────────────┐          │
│        │ Signed Context Validation   │          │
│        │ (HMAC verification)         │          │
│        └──────────────┬──────────────┘          │
│                       │                         │
│              ┌────────▼────────┐                │
│              │ SessionManager   │                │
│              │ (opt-in only)    │                │
│              └─────────────────┘                │
└─────────────────────────────────────────────────┘
```

The `SessionManager` is an optional persistence layer for flows that need server-side drafts or
resumable state. For most flows, no persistence is needed — signed context and domain services
are sufficient.

Same-process hosting is one deployment mode. Split processes, horizontal API scaling, webhook mode,
and edge workers are equally valid because the runtime contract is process-agnostic.

---

## Signed Action Context

Every Mini App action carries a signed context token (`tfp2` prefix). The server validates
signature, expiry, and action authorization before trusted work.

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

### Token lifecycle

```text
Bot command handler
  → calls sign({ flowId, screenId, subject, allowedActions })
  → receives HMAC-signed token
  → embeds token in Mini App launch URL

Mini App opens
  → parses token from tgWebAppStartParam
  → screen renders

Screen calls runAction(actionId, payload)
  → POST to action server with token + actionId + payload
  → server validates token (signature, expiry, allowedActions)
  → server runs action handler
  → returns ActionResult
```

**Key property:** The token is stateless. No server-side flow instance needs to exist for the
token to be valid. The server only verifies the cryptographic signature and expiry.

---

## Default Model: No Persisted State

For most flows, the runtime does not persist any state. Each interaction is self-contained:

```text
signed context + action + payload
  → validate context
  → validate payload
  → load domain data if needed
  → run handler
  → return result/effects
```

The framework knows:

- flow id, screen id, action id
- launch context (from signed token)
- allowed actions (from signed token)
- handler mapping (from flow definition)

It does not need to persist:

- current step
- flow state
- transition revision

---

## Optional: Session State

A flow can declare `session: { enabled: true }` to opt into lightweight server-side session state.

```ts
defineFlow({
  id: "builder-project",

  session: {
    enabled: true,
    ttlSeconds: 86400,
    initialState: {
      projectSpec: null,
      draftScreens: []
    }
  },

  // ... command, routes, actions
});
```

### Session model

```ts
interface TeleforgeSession<TState> {
  sessionId: string;
  flowId: string;
  userId: string;
  state: TState;
  status: "active" | "completed" | "expired" | "cancelled";
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  revision: number;
}
```

### Session API

```ts
interface SessionHandle<TState> {
  get(): Promise<TState>;
  set(next: TState): Promise<void>;
  patch(partial: Partial<TState>): Promise<void>;
  clear(): Promise<void>;
  complete(): Promise<void>;
}
```

Session state should be small, scoped, and TTL-bound.
It should not become a replacement for the application database.

### Use session state for

- AI builder project drafts
- unsaved multi-screen form drafts
- resumable onboarding
- payment or approval waits
- external webhook waits
- temporary server-side data before domain commit

### Do not use session state for

- orders that already exist in the orders table
- deliveries from the logistics backend
- products fetched from catalog service
- user profiles stored in the app database
- simple one-shot form submissions

---

## Action Result Contract

Every action returns a normalized result.

```ts
interface ActionResult {
  data?: Record<string, unknown>;
  navigate?: string;
  closeMiniApp?: boolean;
  showHandoff?: string | boolean;
  effects?: ActionEffect[];
}
```

### Effects

The runtime emits effects as part of the action result.

| Effect          | Description                                           | Realized By                 |
| --------------- | ----------------------------------------------------- | --------------------------- |
| `chatMessage`   | Send a chat message                                   | Bot adapter                 |
| `openMiniApp`   | Launch Mini App with signed payload                   | Bot adapter                 |
| `navigate`      | Change active Mini App screen                         | Mini App client runtime     |
| `webhook`        | POST to external endpoint                             | Worker or integration layer |
| `custom`        | Application-specific effect                           | Custom handler              |

### Handoff

```ts
return {
  showHandoff: "Rescheduled successfully.",
  closeMiniApp: true,
  effects: [{ type: "chatMessage", text: "Rescheduled." }]
};
```

The Mini App runtime shows the handoff message and closes. The bot runtime sends chat messages.

### Navigation

```ts
return {
  navigate: "shop.cart",
  data: { itemCount: 3 }
};
```

The Mini App runtime navigates to the new screen without a full page reload.

---

## Screen Contract

Screens receive context from the runtime and invoke actions.

```tsx
interface TeleforgeScreenComponentProps {
  launch: LaunchContext;
  screenId: string;
  routePath: string;
  data?: unknown;
  loaderData?: unknown;
  session?: unknown;
  transitioning: boolean;
  runAction: (actionId: string, payload?: unknown) => Promise<ActionResult>;
  navigate: (screenIdOrRoute: string, params?: Record<string, unknown>) => void;
}
```

Screens call `runAction()` to invoke server-side action handlers. They should not call services
directly from the browser.

```tsx
export default defineScreen({
  id: "shop.catalog",
  component({ runAction, transitioning }) {
    return (
      <button
        onClick={() => runAction("addToCart", { productId: "p1" })}
        disabled={transitioning}
      >
        Add to cart
      </button>
    );
  }
});
```

---

## Deployment Modes

The same runtime contract supports multiple hosting models:

| Mode                | How                                                                      | When                            |
| ------------------- | ------------------------------------------------------------------------ | ------------------------------- |
| **Same-process**    | Bot starts action server, shares runtime object                          | Local dev, small apps           |
| **Split processes** | Bot and server are separate processes, share signing secret              | Production, horizontal scaling  |
| **Webhook mode**    | Single HTTP process handles both Telegram webhooks and action requests  | Serverless or cloud deployment  |
| **Edge workers**    | Action server runs at edge, bot runs centrally                           | Global latency, edge-first apps |

The framework does not care which mode is used. The signed context + action handler contract
stays the same.

---

## Why This Model

### Why not persist step state?

- Telegram surfaces do not behave like one continuous workflow transport
- Mini Apps can be opened from old signed links
- users can reopen, duplicate, or deep-link screens
- most application data already belongs in domain services

### Why signed context instead of step tracking?

The better question is not "what step is this user on?" but "is this action valid for this
signed context and current domain data?"

### Why optional sessions?

Most flows don't need server-side persistence. Sessions exist for the minority that do
(AI builders, drafts, external waits) and stay TTL-bound and scoped.

### Why effects instead of step transitions?

Because an action produces deterministic results. The runtime executes effects from
the action result, not from a persistent step graph traversal.
