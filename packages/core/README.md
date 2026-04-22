# `packages/core`

Internal Teleforge implementation layer for shared contracts.

App authors should import from the unified `teleforge` package:

```ts
import { UserFlowStateManager, createFlowStorage, defineFlow } from "teleforge";
import { parseLaunchContext } from "teleforge/core/browser";
```

This package contains shared schema, launch parsing, validation, flow-state, and storage primitives used by the framework. It remains a workspace package so the internal runtime layers can share contracts, but it is not the public app authoring surface.

Use `teleforge/core/browser` when browser code needs launch or validation helpers. Use `teleforge` for server-side/shared flow helpers.
