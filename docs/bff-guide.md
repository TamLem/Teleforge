# Server Hooks and Backend Internals

This guide explains Teleforge's trusted server-side path.

The public model is:

- define product behavior as flows
- bind Mini App steps to screens
- add server hooks only when a step needs trusted server authority

Do not treat backend work as a separate Teleforge app mode. Server hooks are part of the flow runtime.

## When to Use Server Hooks

Use server hooks for work the browser must not control:

- checking flow instance ownership
- enforcing permissions
- loading user-specific or private data
- validating submit/action payloads on the server
- creating orders, payments, sessions, tickets, or other durable records
- calling downstream services with server-only credentials

Keep simple local UI state in the screen. Keep durable product state in the flow instance or domain services.

## Hook Types

Server hooks are discovered by convention and executed through the framework bridge.

Common hook responsibilities are:

- `guard`: decide whether the user can enter a step
- `loader`: prepare screen-specific data before render or refresh
- `submit`: complete or advance a Mini App step with trusted validation
- `action`: run a trusted interaction that may not complete the step

The hook should return typed data or transition results that the runtime can apply to the current flow instance.

## Suggested Structure

```text
apps/bot/src/flows/
  checkout.flow.ts

apps/bot/src/flow-server-hooks/
  checkout/
    catalog.ts
    review.ts
```

Use the flow and step ids as the filesystem boundary. This keeps backend logic close to the flow step that owns it.

## Example Loader and Submit

```ts
export async function loader({ state, actor, services }) {
  const products = await services.catalog.listForUser(actor.id);

  return {
    products,
    selectedItemId: state.selectedItemId ?? null
  };
}

export async function submit({ data, state, services }) {
  const item = await services.catalog.requireAvailable(data.itemId);

  return {
    state: {
      ...state,
      selectedItemId: item.id
    },
    to: "review"
  };
}
```

The exact service wiring is app-owned. Teleforge owns the bridge, state handoff, and flow transition contract.

## Security Boundary

The frontend can render UI and collect input. It is not authoritative for:

- identity trust
- flow instance ownership
- step validity
- permission decisions
- durable state mutation

Server hooks should validate those conditions before returning success.

## Internal Backend Primitives

This repository still contains internal request, identity, session, and route primitives under `packages/bff`. Those exist so the framework can share backend implementation code.

App authors should not import an internal package to build a normal Teleforge app. Use `teleforge/server-hooks` and the generated runtime conventions instead.

## Shared Phone Auth

Phone auth is also a server-hook concern:

1. the bot requests a self-shared contact
2. the bot signs a short-lived phone-auth token
3. the Mini App passes that token to trusted server code
4. the server validates the token, matches it to the Telegram user, and resolves the app user

See [Shared Phone Auth](./shared-phone-auth.md) for the end-to-end flow.

## Read Next

- [Developer Guide](./developer-guide.md)
- [Flow Coordination](./flow-coordination.md)
- [Deployment](./deployment.md)
