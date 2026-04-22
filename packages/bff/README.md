# `packages/bff`

Internal Teleforge backend implementation layer.

App authors should model trusted backend work as flow server hooks and use:

```ts
import { createDiscoveredServerHooksHandler } from "teleforge/server-hooks";
```

This package contains request context, identity, session, middleware, and route primitives used by the framework's server-side implementation. It is not a public app mode and should not be introduced in application setup docs.

Use server hooks for trusted guards, loaders, submits, actions, identity exchange, and downstream service calls.
