# `@teleforge/web`

Internal Teleforge implementation layer for the Mini App runtime.

App authors should import Mini App helpers through the unified package:

```tsx
import { TeleforgeMiniApp, defineScreen, useLaunch, useTelegram, useTheme } from "teleforge/web";
```

This package implements Telegram WebApp hooks, screen runtime helpers, and browser-side coordination used by `teleforge/web`.
