# teleforge

## 0.2.0

### Minor Changes

Teleforge 0.2.0 replaces the step-machine execution model with an **action-first** model. This is a breaking change across the entire framework surface.

#### `defineFlow` — new action-first API

```ts
// Old (0.1.x) — step-machine model
defineFlow({ id, initialStep, finalStep, state, steps: { welcome: chatStep(...), catalog: miniAppStep("catalog") } })

// New (0.2.0) — action-first model
defineFlow({ id, command?, handlers?, miniApp?, actions?, session? })
```

- **Removed**: `steps`, `initialStep`, `finalStep`, `state` from the flow definition shape
- **Removed**: step types (`chatStep`, `miniAppStep`) and step helpers (`openMiniAppAction`, `requestPhoneAction`, `requestPhoneAuthAction`, `requestLocationAction`, `returnToChatAction`)
- **Removed**: `onSubmit({ data, state }) → { state, to }` on Mini App steps — replaced by action handlers returning `ActionResult`
- **Removed**: `onEnter` step handlers — replaced by `onContact`/`onLocation` flow handlers
- **Removed**: `miniApp.stepRoutes` — replaced by `miniApp.routes`

#### Action-first execution model

User interactions now resolve through **signed context tokens** and **deterministic action handlers** rather than persisted step state:

```text
signed context + action + payload
  → validate context
  → validate payload
  → load domain data if needed
  → run handler
  → return result/effects
```

No server-side step tracking. No `UserFlowStateManager`. No `advanceStep`.

#### Signed action context

- `ActionContextToken` (prefix `tfp2`): HMAC-signed token carrying `flowId`, `screenId`, `userId`, `subject`, `allowedActions`, expiry
- `sign()` helper available in all handler contexts (`command`, `onContact`, `onLocation`) — returns a full Mini App launch URL
- Server validates token signature, expiry, and action authorization before every action

#### Action handlers + effects

```ts
actions: {
  submitOrder: {
    handler: async ({ ctx, data, services }) => ({
      navigate: "confirm",
      data: { orderId: "ord_123" }
    })
  },
  cancel: {
    handler: async () => ({
      showHandoff: "Returning to chat...",
      closeMiniApp: true,
      effects: [{ type: "chatMessage", text: "Cancelled." }]
    })
  }
}
```

- `ActionResult { data?, navigate?, closeMiniApp?, showHandoff?, effects? }`
- Effects dispatched by the action server via `onChatHandoff` callback
- `navigate` in `ActionResult` triggers client-side screen transition
- `showHandoff` + `closeMiniApp` triggers return-to-chat

#### Flow handlers (onContact / onLocation)

```ts
handlers: {
  onContact: async ({ ctx, shared, sign, services }) => {
    // shared.normalizedPhone is validated as self-shared
    const launch = await sign({ flowId: "...", screenId: "...", subject: {...}, allowedActions: [...] });
    await ctx.reply("Verified.", { reply_markup: { inline_keyboard: [[{ text: "Open", web_app: { url: launch } }]] } });
  }
}
```

- Contact/location keyboard automatically dismissed by the framework after handler completes
- Only one flow may declare `onContact` / `onLocation` across all flows
- Duplicate commands across flows cause a registration error

#### Optional session state

```ts
defineFlow({ id: "builder", session: { enabled: true, ttlSeconds: 86400, initialState: { drafts: [] } }, ... })
```

- `SessionManager` / `SessionHandle` with `get`, `set`, `patch`, `clear`, `complete`
- Opt-in per flow — no automatic session creation
- TTL-bound, scoped server-side state for drafts, wizards, external waits

#### Mini App runtime

Screen props changed:
- Old: `{ flow, state, stepId, submit }`
- New: `{ launch, data, runAction, navigate, transitioning }`

Screens call `runAction(actionId, payload)` to invoke server actions. `TeleforgeMiniApp` resolves screens from the client manifest route registry (no step resolution).

#### Bot runtime

- `startTeleforgeBot` now includes full Telegram polling/webhook infrastructure (was previously in CLI only)
- Bot sends `reply_markup: { remove_keyboard: true }` automatically after contact/location shares

#### Server protocol

| Old (0.1.x) | New (0.2.0) |
|---|---|
| `POST /api/teleforge/flow-hooks` with `kind: "load"` | `POST /api/teleforge/actions` with `kind: "loadScreenContext"` |
| `POST /api/teleforge/flow-hooks` with `kind: "submit"` | `POST /api/teleforge/actions` with `kind: "runAction"` |
| `POST /api/teleforge/flow-hooks` with `kind: "action"` | (merged into `runAction`) |
| `POST /api/teleforge/flow-hooks` with `kind: "chatHandoff"` | `POST /api/teleforge/actions` with `kind: "handoff"` |

#### Documentation

All framework docs rewritten for the action-first model.

### Patch Changes

- Updated dependencies
