# @teleforgex/ui

UI primitives built on top of `@teleforgex/web`.

## Installation

```bash
pnpm add @teleforgex/ui @teleforgex/web react react-dom
```

## Exports

```tsx
import {
  AppShell,
  ExpandedOnly,
  FullscreenOnly,
  LaunchModeBoundary,
  TgButton,
  TgCard,
  TgInput,
  TgList,
  TgSpinner,
  TgText
} from "@teleforgex/ui";
```

`AppShell` provides viewport-aware layout, Telegram theme CSS variables, optional header/back button support, and Main Button integration.

The package also includes theme-aware UI primitives powered by Telegram theme values:

```tsx
<TgCard>
  <TgText variant="title">Checkout</TgText>
  <TgInput value={name} onChange={setName} placeholder="Display name" />
  <TgButton variant="primary">Save</TgButton>
</TgCard>
```

`LaunchModeBoundary` adds UI-level protection on top of `@teleforgex/web` launch detection:

```tsx
<LaunchModeBoundary modes={["fullscreen"]} showExpandPrompt>
  <VideoPlayer />
</LaunchModeBoundary>
```

For common cases, `FullscreenOnly` requires fullscreen and `ExpandedOnly` allows `compact` or `fullscreen`.
