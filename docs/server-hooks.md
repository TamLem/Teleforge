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

apps/api/src/flow-hooks/
  checkout/
    catalog.ts
    review.ts
```

Use the flow and step ids as the filesystem boundary. The default scaffold does not include `apps/api`; generate placeholder hook files with `create-teleforge-app my-app --with-api` when a project needs trusted hooks or a webhook placeholder.

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

## Runtime Wiring

In the default runtime path, `teleforge start` discovers server hooks and starts the hooks server when hooks are present. The server also hosts the Telegram webhook endpoint when `runtime.bot.delivery` is `"webhook"`.

For local development, `teleforge dev` runs the simulator and companion services. Use `teleforge doctor` if a hook is not discovered or a Mini App step cannot resolve its trusted runtime path.

## Escape Hatches

App authors should not import internal implementation packages to build a normal Teleforge app. Use generated conventions and `teleforge start` first.

When a custom server owns HTTP routing, import from `teleforge/server-hooks` and mount `createDiscoveredServerHooksHandler()` yourself. Keep that as an advanced hosting path, not the default scaffold model.

## Shared Phone Auth

Phone auth is also a server-hook concern:

1. the bot requests a self-shared contact
2. the bot signs a short-lived phone-auth token
3. the Mini App passes that token to trusted server code
4. the server validates the token, matches it to the Telegram user, and resolves the app user

See [Shared Phone Auth](./shared-phone-auth.md) for the end-to-end flow.

## Read Next

- [Framework Model](./framework-model.md)
- [Developer Guide](./developer-guide.md)
- [Flow Coordination](./flow-coordination.md)
- [Deployment](./deployment.md)
