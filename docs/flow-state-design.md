# Flow State Architecture

## Core Model

Teleforge flow execution is a **framework-owned runtime** backed by a storage adapter. The bot and API are **transport adapters** that invoke the same runtime contract. Neither owns state — they both read and write through the same storage-backed execution layer.

```text
┌─────────────────────────────────────────────────┐
│              Teleforge Flow Runtime             │
│                                                 │
│  ┌──────────┐    ┌──────────┐    ┌───────────┐ │
│  │  Bot     │    │   API    │    │  Future   │ │
│  │ Adapter  │    │ Adapter  │    │  Workers  │ │
│  └────┬─────┘    └────┬─────┘    └─────┬─────┘ │
│       │               │               │         │
│       └───────────────┼───────────────┘         │
│                       │                         │
│              ┌────────▼────────┐                │
│              │ Execution       │                │
│              │ Kernel          │                │
│              └────────┬────────┘                │
│                       │                         │
│        ┌──────────────▼──────────────┐          │
│        │ FlowInstanceRepository      │          │
│        │ TransitionLogRepository     │          │
│        └──────────────┬──────────────┘          │
│                       │                         │
│              ┌────────▼────────┐                │
│              │ StorageAdapter  │                │
│              │ (memory/redis/  │                │
│              │  durable-objs)  │                │
│              └─────────────────┘                │
└─────────────────────────────────────────────────┘
```

The `StorageAdapter` is a low-level persistence primitive. The repositories sit above it and provide semantic operations for flow instances, indexes, and transition/effect logs. Transport adapters interact with the runtime API, never with storage directly.

Same-process hosting is one deployment mode. Split processes, horizontal API scaling, webhook mode, and edge workers are equally valid because the runtime contract is process-agnostic.

---

## Runtime API

The execution kernel exposes a small, explicit surface:

| Method                                               | Purpose                                                                     |
| ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `createInstance(flowId, userId, initialStep, state)` | Start a new flow instance, return `instanceId`                              |
| `load(instanceId, stepId?)`                          | Resolve authoritative view: state, step, guards, loaders, available actions |
| `transition(instanceId, signal)`                     | Process a signal, persist next state, return `TransitionResult`             |
| `resume(instanceId)`                                 | Resume a suspended instance from its last checkpoint                        |
| `cancel(instanceId)`                                 | Mark instance as cancelled and emit cleanup effects                         |
| `complete(instanceId)`                               | Mark instance as completed and emit final effects                           |

Transport adapters call these methods. The runtime handles validation, persistence, logging, and effect emission.

---

## Signal Model

Every incoming interaction is normalized into a **signal** before entering the runtime.

### Signal categories

| Category             | Examples                                                         |
| -------------------- | ---------------------------------------------------------------- |
| **Chat signals**     | user message, slash command, callback query, inline button tap   |
| **Mini App signals** | screen submit, screen action, client navigation intent           |
| **System signals**   | timeout fired, resume request, cancellation request              |
| **External signals** | webhook received, async job completed, third-party status update |

### Example shape

```ts
interface RuntimeSignal {
  signalId?: string;
  type: string;
  source: "chat" | "miniapp" | "system" | "external";
  data?: Record<string, unknown>;
  metadata?: {
    telegramUpdateId?: number;
    userId?: string;
    chatId?: string;
    timestamp?: number;
  };
}
```

Signals are transport-neutral. Adapters translate transport-specific payloads into runtime signals.

---

## Flow Instance Model

Each flow instance is tracked as a first-class runtime entity:

| Field              | Purpose                                                                   |
| ------------------ | ------------------------------------------------------------------------- |
| `instanceId`       | Unique flow instance identifier (ULID)                                    |
| `flowId`           | Which flow definition this instance belongs to                            |
| `status`           | `active`, `completed`, `suspended`, `failed`, `cancelled`                 |
| `currentSurface`   | `chat`, `miniapp`, `background` — where execution is currently paused     |
| `waitReason`       | `userInput`, `externalEvent`, `backgroundWork`, `handoffPending`, `error` |
| `stepId`           | Current step within the flow                                              |
| `state`            | Authoritative flow state                                                  |
| `userId`           | Telegram user who owns this instance                                      |
| `chatId`           | Telegram chat ID when relevant                                            |
| `revision`         | Monotonic counter for optimistic locking                                  |
| `createdAt`        | Instance creation timestamp                                               |
| `lastTransitionAt` | Last state change timestamp                                               |
| `expiresAt`        | When the instance is eligible for cleanup                                 |

### `status` vs `waitReason`

`status` describes the instance lifecycle. `waitReason` describes why an active or suspended instance is paused:

- `userInput` — waiting for user action
- `externalEvent` — waiting for webhook, timeout, or external system
- `backgroundWork` — async job is running
- `handoffPending` — transition committed, surface handoff not fully realized yet
- `error` — execution failed and awaits retry, cancel, or operator recovery

---

## Instance Keys and Indexing

Storage keys are derived from `instanceId`:

```text
instance:ulid_01jxyz...
```

Secondary indexes enable lookup by user and flow. Because multiple concurrent instances per user+flow are allowed, indexes are collection-valued:

```text
user:123:flow:shop-catalogue:active   → [instance:ulid_01a..., instance:ulid_01b...]
user:123:flow:shop-catalogue:latest   → instance:ulid_01b...
user:123:flow:shop-catalogue:history  → [instance:ulid_00z..., instance:ulid_01a..., ...]
```

This supports concurrent instances, retries, drafts, and historical inspection.

---

## State Boundaries

| Boundary               | Where                        | What                                                   |
| ---------------------- | ---------------------------- | ------------------------------------------------------ |
| **Flow state**         | Runtime + repository         | Durable shared state across surfaces                   |
| **Local UI state**     | Screen component             | Transient UI state                                     |
| **Domain state**       | External database/services   | Persistent application state outside the flow instance |
| **Derived view state** | Computed in screen or loader | Non-persisted values derived from flow or domain state |

Screens interact with flow state through the runtime contract and keep local UI state locally.

---

## Transition Result Contract

Every successful transition returns a normalized result.

```ts
interface TransitionResult {
  instanceId: string;
  revision: number;
  status: "active" | "completed" | "suspended" | "failed" | "cancelled";
  currentSurface: "chat" | "miniapp" | "background";
  stepId: string;
  state: Record<string, unknown>;
  effects: Effect[];
  requiresReload?: boolean;
}
```

### Meaning of fields

- `revision` identifies the committed state version
- `currentSurface` tells adapters where execution now lives
- `effects` contains the side effects adapters or workers must realize
- `requiresReload` tells the Mini App runtime whether it should call `load()` again before rendering the next screen

---

## Effects

The runtime emits effects after computing the next committed state. Effects are categorized by ownership and scope.

### 1. Surface Effects

These change what the user sees.

| Effect           | Description                                           | Realized By             |
| ---------------- | ----------------------------------------------------- | ----------------------- |
| `sendMessage`    | Send a chat message with optional actions             | Bot adapter             |
| `editMessage`    | Update an existing chat message                       | Bot adapter             |
| `openMiniApp`    | Launch Mini App with signed payload                   | Bot adapter             |
| `showHandoff`    | Show return-to-chat or close guidance inside Mini App | Mini App client runtime |
| `navigateScreen` | Change active Mini App screen                         | Mini App client runtime |
| `closeMiniApp`   | Request Mini App close                                | Mini App client runtime |

### 2. System Effects

These manage execution rather than UI.

| Effect            | Description                            | Realized By                 |
| ----------------- | -------------------------------------- | --------------------------- |
| `scheduleTimeout` | Schedule future signal delivery        | Runtime scheduler or worker |
| `suspendInstance` | Mark instance suspended                | Runtime                     |
| `cancelInstance`  | Mark instance cancelled                | Runtime                     |
| `resumeInstance`  | Requeue execution of a paused instance | Runtime or worker           |

### 3. Integration Effects

These communicate beyond the runtime.

| Effect                  | Description                               | Realized By                    |
| ----------------------- | ----------------------------------------- | ------------------------------ |
| `webhook`               | POST to external endpoint                 | API adapter or worker          |
| `emitEvent`             | Publish to event bus                      | Runtime or worker              |
| `invokeExternalCommand` | Trigger external integration after commit | Worker or integration executor |

### What is **not** an effect

`checkpoint` is **not** modeled as an emitted effect. Persisting the new instance snapshot is part of transition commit, not adapter work. That keeps the effect model reserved for work that happens **after** commit.

---

## Effect Delivery Semantics

Effects are **logged before dispatch**. The runtime commits the new instance state and the effect log atomically before any adapter or worker sees the result.

This gives the following guarantees:

- **State and effect log are atomic** — committed together or not at all
- **Effects are replayable** — crashes do not erase undispatched effects
- **Effects are idempotent by design** — each effect carries a dedup key derived from `instanceId:revision:effectIndex`
- **Delivery is at-least-once** — the same effect may be replayed after failure

Adapters and workers must treat effect handlers as idempotent.

---

## Execution Contract

### Transition lifecycle

1. Adapter receives a transport event
2. Adapter normalizes it into a `RuntimeSignal`
3. Adapter calls `runtime.transition(instanceId, signal)`
4. Runtime validates signal against the current instance
5. Runtime runs the step handler
6. Runtime computes next state, next step, next surface, and effect set
7. Runtime persists instance snapshot and transition/effect log atomically
8. Runtime returns `TransitionResult`
9. Adapters or workers realize effects

```text
Signal → runtime.transition() → TransitionResult → effect realization
```

### Read path: `load()`

When a screen enters, the runtime resolves a complete view:

```text
screen enters
  → runtime.load(instanceId, stepId)
    → fetch instance from repository
    → run guard hooks
    → run loader hooks
    → resolve available actions
    → return { state, step, guardResult, loaderData, availableActions }
```

### Write path: `transition()`

```text
submit(data)
  → runtime.transition(instanceId, { type: "submit", data })
    → validate instance is active
    → run onSubmit handler
    → compute next state and target step
    → build effect set
    → persist instance + transition/effect log atomically
    → return TransitionResult
```

---

## Failure Semantics

Not all failures are equal. The runtime should classify them explicitly.

### Failure classes

| Class                     | Meaning                                                  | Typical handling                                                     |
| ------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| `validation_error`        | Signal payload or screen submission is invalid           | Return error to caller, no state change                              |
| `unauthorized`            | User or surface is not allowed to act on the instance    | Reject signal, no state change                                       |
| `stale_revision`          | Concurrent change already committed                      | Reject transition, caller reloads                                    |
| `invalid_transition`      | Signal is not legal from current step/state              | Reject transition, caller reloads or surfaces recovery               |
| `handler_failure`         | Step handler or domain logic threw                       | Mark instance `failed` or return retriable error depending on policy |
| `effect_delivery_failure` | State committed, but effect dispatch failed after commit | Keep instance committed, replay effects later                        |

### Important rule

**Transition failure before commit does not mutate instance state.**

**Effect failure after commit does not roll back state.**

That separation is critical.

---

## Idempotency

Duplicate signals are inevitable:

- user taps a callback twice
- Mini App submit retries after network interruption
- Telegram redelivers an update

The runtime handles this through:

1. **Revision-based optimistic locking** — each transition increments `revision`; stale writes fail
2. **Effect dedup keys** — each effect carries `instanceId:revision:effectIndex`
3. **Signal dedup** — adapters may pass `signalId`; runtime rejects already-processed signals

The execution guarantee is:

- **at-most-once transition execution**
- **at-least-once effect delivery**

---

## Storage vs Repository

### StorageAdapter (low-level)

```ts
interface StorageAdapter {
  readonly defaultTTL: number;
  readonly namespace?: string;

  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  touch(key: string, ttl: number): Promise<void>;
  compareAndSet?(
    key: string,
    expectedRevision: number,
    value: string,
    ttl?: number
  ): Promise<boolean>;
}
```

The storage adapter is a generic string-keyed store. It knows nothing about flow instances, signals, effects, or indexes.

### FlowInstanceRepository (semantic)

```ts
interface FlowInstanceRepository {
  getInstance(instanceId: string): Promise<FlowInstance | null>;
  saveInstance(instance: FlowInstance): Promise<void>;
  listActiveInstances(userId: string, flowId: string): Promise<FlowInstance[]>;
  getLatestInstance(userId: string, flowId: string): Promise<FlowInstance | null>;
  listInstanceHistory(userId: string, flowId: string): Promise<FlowInstance[]>;
}
```

This repository manages instance snapshots and indexes.

### TransitionLogRepository (semantic)

```ts
interface TransitionLogRepository {
  recordTransition(
    instanceId: string,
    revision: number,
    signal: RuntimeSignal,
    effects: Effect[]
  ): Promise<void>;
  hasProcessedSignal(instanceId: string, signalId: string): Promise<boolean>;
  listPendingEffects(instanceId: string): Promise<Effect[]>;
  markEffectDelivered(effectDedupKey: string): Promise<void>;
}
```

This repository owns transition logs, signal dedup checks, pending effect replay, and effect delivery bookkeeping.

---

## Data Flow

### Chat → Mini App

```text
User taps web_app button in chat
  → Button URL contains signed payload: { flowId, stepId, instanceId }
  → Mini App opens and calls runtime.load(instanceId, stepId)
  → Runtime fetches instance, runs guards/loaders
  → Returns authoritative screen view
  → Screen renders with authoritative state
```

### Mini App → Chat

```text
Screen calls submit({ type: "complete-order" })
  → runtime.transition(instanceId, { type: "submit", data })
  → runtime commits state with currentSurface=chat, stepId=confirmed
  → runtime returns effects: [sendMessage(...), showHandoff(...)]
  → Bot adapter realizes sendMessage
  → Mini App client runtime realizes showHandoff
```

### Mini App → Mini App

```text
Screen calls submit({ type: "go-to-checkout" })
  → runtime.transition(instanceId, { type: "submit", data })
  → runtime commits state with currentSurface=miniapp, stepId=checkout
  → runtime returns effects: [navigateScreen({ screenId: "shop.checkout" })]
  → Mini App client runtime realizes navigateScreen
  → next screen renders using committed state or refreshed load()
```

---

## Deployment Modes

The same runtime contract supports multiple hosting models:

| Mode                | How                                                                      | When                            |
| ------------------- | ------------------------------------------------------------------------ | ------------------------------- |
| **Same-process**    | Bot starts API server, shares runtime object                             | Local dev, small apps           |
| **Split processes** | Bot and API are separate processes, share storage via Redis              | Production, horizontal scaling  |
| **Webhook mode**    | Single HTTP process handles both Telegram webhooks and Mini App requests | Serverless or cloud deployment  |
| **Edge workers**    | API runs at edge, bot runs centrally, shared KV or durable storage       | Global latency, edge-first apps |

The framework does not care which mode is used. The runtime contract stays the same.

---

## Screen Contract

Screens receive authoritative flow state via the `state` prop. They should not read state from launch payloads.

```tsx
export default defineScreen<ShopState>({
  component({ state, submit }) {
    const item = items.find((t) => t.id === state.selectedItem);
    return <Checkout item={item} onSubmit={() => submit({ type: "complete-order" })} />;
  }
});
```

Incorrect pattern:

```tsx
const { flowContext } = useLaunchCoordination();
const state = flowContext?.payload?.state;
```

The runtime resolves authoritative state through `load()`. Screens consume that result rather than reconstructing state themselves.

---

## Why This Model

### Why not embed state in the launch payload?

- payload size grows with state
- payload state is stale by definition
- frontend carries data it does not need to authoritatively own

### Why not fetch state on every render?

`load()` happens on screen entry, not every render. The screen keeps the resolved state for its current lifecycle.

### Why split repository from raw storage?

Because runtime semantics are richer than plain key-value CRUD. Indexing, transition logs, and effect replay should not leak into every adapter.

### Why use effects instead of direct adapter calls?

Because the runtime should stay transport-neutral. It computes committed state and post-commit work. Adapters and workers realize that work in their domains.
