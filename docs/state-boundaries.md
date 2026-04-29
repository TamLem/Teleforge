# State Boundaries

This is the canonical page for state and trust boundaries in Teleforge. It explains where each
piece of data lives, who owns it, and how it travels between chat, Mini App, and server.

For how the runtime moves data through the chain — from `sign()` to screen props to action
handlers — see [Runtime Wiring](./runtime-wiring.md).

---

## Three State Categories

Teleforge data falls into three trust categories:

### 1. Signed Context (server authority)

The `tfp2` token is the trust anchor for every request. It is created by `sign()` and
validated by the action server on every action and loader request.

```ts
interface ActionContextToken {
  appId: string;
  flowId: string;
  screenId?: string;
  userId: string;
  subject?: Record<string, unknown>;  // IDs and scope only
  allowedActions?: string[];
  issuedAt: number;
  expiresAt: number;
}
```

`subject` should contain IDs and scope, never full domain payloads. The server checks
signature, expiry, and `allowedActions` before running any handler.

For what `sign()` creates and what belongs in `subject`, see [Runtime Wiring](./runtime-wiring.md).

### 2. Session Resources (server-owned mutable state)

When a flow has `session: { enabled: true }`, handlers and loaders receive a `SessionHandle`
with resource access:

```ts
const cart = session.resource<{ items: CartItem[] }>("cart", {
  initialValue: { items: [] }
});

// Read
const { items } = await cart.get();

// Mutate
await cart.update((draft) => {
  draft.items.push(newItem);
});

// Replace
await cart.set({ items: newItems });

// Remove
await cart.clear();
```

Resources are isolated by user and flow. They persist through the session storage adapter
and are TTL-bound. Use for:

- cart contents
- draft form data
- order references
- multi-step wizard progress

### 3. Screen State (client-owned, framework-injected)

Screens receive explicit props that make the trust boundary clear. The Mini App runtime
injects these — they are not passed by parent components or parsed from the URL by hand.

| Prop | Source | Trust | Purpose |
|---|---|---|---|
| `scopeData` | Signed context `subject` | **Server** | Immutable IDs and scope from the signed token |
| `routeParams` | Matched route pattern | **Framework** | URL params like `{ id: "iphone-15" }` from `/product/:id` |
| `routeData` | `navigate({ data })` | **Client** | Ephemeral data passed during screen transition |
| `loader` | Server loader result | **Server** | `{ status, data, error }` discriminated lifecycle |
| `loaderData` | `loader.data` when ready | **Server** | Typed convenience accessor for the loader result |
| `appState` | React context | **Client** | Cross-screen ephemeral state |
| `actions` | Runtime helpers | **Framework** | `actions.addToCart(payload)` sends to action server |
| `nav` | Runtime helpers | **Framework** | `nav.cart()` changes screen client-side |
| `transitioning` | Runtime flag | **Framework** | True while an action or navigation is in flight |

**Rules:**

- `scopeData` is immutable. The screen cannot modify it.
- `routeParams` is read-only. Extracted from the URL pattern by the framework.
- `routeData` is ephemeral. It lasts one navigation and is not persisted.
- `loaderData` comes from the server. Do not treat it as client-authoritative.
- `appState` is client-only. Use for selections, filters, and UI preferences.

For why props are injected and how they travel through the runtime, see [Runtime Wiring](./runtime-wiring.md).

---

## Five State Types

Within the screen and session boundaries, keep these scopes separate:

| Type | Scope | Examples |
|---|---|---|
| **Domain state** | Persistent, in database or services | user profile, product catalog, order history |
| **Local UI state** | Ephemeral, screen-only | open modals, unsaved inputs, temporary filters, loading flags |
| **Session state** | Optional, server-side, `session.resource` | cart items, drafts, external wait state |
| **App state** | Mini App-local, cross-screen, ephemeral | selections, filters, UI preferences |
| **Derived view state** | Computed, usually not persisted | formatted prices, filtered lists, sort order |

**Rules:**

- Domain state lives in your database or services. Loaders fetch it. Actions mutate it.
- Local UI state stays in React component state or hooks. Do not send it to the server.
- Session state uses `session.resource()` for data that must survive screen transitions but does not belong in the domain database yet.
- App state uses `useAppState()` for data that spans screens but does not need server persistence.
- Derived state is computed from the above. Do not persist it unless it is a domain fact.

---

## Storage Architecture

Session storage uses a pluggable `SessionStorageAdapter`:

```ts
interface SessionStorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  touch(key: string, ttl: number): Promise<void>;
}
```

The default adapter is `MemorySessionStorageAdapter`. Production apps should provide their own
persistent adapter (Redis, database, etc.).

Session keys follow the pattern `session:{userId}:{flowId}:{sessionId}`.

---

## Security Properties

| Property | Mechanism |
|---|---|
| Request authenticity | HMAC-signed `tfp2` token |
| Expiry | Token `expiresAt` checked on every request |
| Action authorization | `allowedActions` enforced server-side |
| Screen authorization | `screenId` validated against flow routes |
| Input validation | Optional `input` schema before handler runs |
| Resource isolation | Resources keyed by user + flow within session |

---

## Read Next

- [Runtime Wiring](./runtime-wiring.md): how data moves through the runtime chain
- [Framework Model](./framework-model.md): high-level authoring model
- [Server Actions](./server-hooks.md): practical guide to action handlers and loaders
- [Config Reference](./config-reference.md): exact API shapes for `session.resource`, `SessionStorageAdapter`, and related types
