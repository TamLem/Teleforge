# Flow State Architecture

## Core Model

Teleforge action execution is a **framework-owned runtime** backed by optional session storage.
The bot and action server are **transport adapters** that invoke the same runtime contract.
Neither owns state — they validate signed action context and run handlers.

```text
┌──────────────────────────────────────────────────────┐
│              Teleforge Action Runtime                │
│                                                      │
│  ┌──────────┐    ┌──────────┐    ┌───────────────┐  │
│  │  Bot     │    │ Action   │    │  Screen       │  │
│  │ Adapter  │    │ Server   │    │  Loaders      │  │
│  └────┬─────┘    └────┬─────┘    └──────┬────────┘  │
│       │               │                 │           │
│       └───────────────┼─────────────────┘           │
│                       │                              │
│              ┌────────▼────────┐                     │
│              │ Action          │                     │
│              │ Registry        │                     │
│              └────────┬────────┘                     │
│                       │                              │
│        ┌──────────────▼──────────────┐               │
│        │ Signed Context Validation   │               │
│        │ (HMAC verification)         │               │
│        └──────────────┬──────────────┘               │
│                       │                              │
│              ┌────────▼────────┐                     │
│              │ Handler         │                     │
│              │ Execution       │                     │
│              └────────┬────────┘                     │
│                       │                              │
│        ┌──────────────▼──────────────┐               │
│        │ Optional Session Storage   │               │
│        │ (per user+flow)             │               │
│        └─────────────────────────────┘               │
└──────────────────────────────────────────────────────┘
```

## State Model

Teleforge distinguishes three state categories, each with a different trust model:

### 1. Signed Context (authority)

The signed action context (`tfp2` token) is the trust anchor for every request. It carries:

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

The token is HMAC-signed and verified server-side on every action and loader request.
`subject` should contain IDs and scope, never full domain payloads.

### 2. Session Resources (server-owned state)

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

### 3. Screen State (client-owned)

Client-side state is structured into three layers:

| Layer | Scope | Mechanism |
|---|---|---|
| `scopeData` | Immutable per entry | Signed context subject |
| `routeParams` | Current screen | Route pattern match |
| `routeData` | Per navigation | `navigate({ data })` |
| `loader`/`loaderData` | Server-provided | Server loaders |
| `appState` | Cross-screen | React context (`useAppState`) |

## Execution Flow

### Action Request

1. Mini App calls `actions.addToCart({ productId, qty })`
2. Server bridge POSTs `{ kind: "runAction", input: { actionId, flowId, signedContext, payload } }`
3. Action server validates the signed context (signature, expiry, allowedActions)
4. If schema provided, validates `input` via `parseTeleforgeInput`
5. Runs the handler
6. Returns `ActionResult` to the Mini App
7. Mini App applies effects, handoff, or redirect

### Loader Request

1. Screen resolves → framework computes `activePathname` and extracts `routeParams`
2. Server bridge POSTs `{ kind: "loadScreenContext", input: { flowId, screenId, signedContext, params } }`
3. Action server validates the signed context and finds the flow
4. Validates that `screenId` is a route in the flow's `miniApp.routes`
5. If loader file exists for `screenId`, validates input (if schema provided) and runs handler
6. Returns `{ data, loaderFound, session }`
7. Client sets `loader.status` to `ready`, `idle`, or `error` based on response

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

## Security Properties

| Property | Mechanism |
|---|---|
| Request authenticity | HMAC-signed `tfp2` token |
| Expiry | Token `expiresAt` checked on every request |
| Action authorization | `allowedActions` enforced server-side |
| Screen authorization | `screenId` validated against flow routes |
| Input validation | Optional `input` schema before handler runs |
| Resource isolation | Resources keyed by user + flow within session |

## Read Next

- [Framework Model](./framework-model.md)
- [Server Actions](./server-hooks.md)
- [Config Reference](./config-reference.md)
- [Deployment](./deployment.md)
