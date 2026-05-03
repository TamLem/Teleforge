# `@teleforge/core`

Internal Teleforge implementation layer for shared contracts, action context signing, session storage, launch parsing, and validation.

App authors should import from the unified `teleforge` package:

```ts
import { defineFlow, startTeleforgeBot } from "teleforge";
```

Browser-safe helpers are available at:

```ts
import { parseLaunchContext } from "teleforge/core/browser";
```

This package contains shared types, validation, launch parsing, action context signing, and optional session storage used by the framework. It remains a workspace package so the internal runtime layers can share contracts, but it is not the public app authoring surface.
