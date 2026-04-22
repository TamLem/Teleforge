# `packages/ui`

Internal Teleforge implementation layer for Telegram-aware React UI primitives.

App authors should import UI components from:

```tsx
import { AppShell, LaunchModeBoundary, MainButton, TgCard, TgText } from "teleforge/ui";
```

This package builds on the Mini App runtime and provides reusable UI primitives. It is kept as an internal package so framework maintainers can test and evolve the layer independently.
