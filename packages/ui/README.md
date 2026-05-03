# `packages/ui`

Internal Teleforge implementation layer for Telegram-aware React UI primitives.

This package is no longer re-exported through the public `teleforge` package. Apps that need these primitives can depend on `@teleforge/ui` directly, or inline their own theme-aware components using `teleforge/web` hooks (`useTheme`, `useTelegram`, `useMainButton`).

This package builds on the Mini App runtime and provides reusable UI primitives. It is kept as an internal package so framework maintainers can test and evolve the layer independently.
