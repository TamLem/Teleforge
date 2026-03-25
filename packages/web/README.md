# @teleforge/web

React hooks and types for Telegram WebApp integration.

## Exports

```ts
import { useTelegram, useTheme } from "@teleforge/web";
```

`useTelegram` provides SSR-safe access to the Telegram WebApp SDK, reactive theme and viewport state, and DEV-003 mock detection.

`useTheme` builds on `useTelegram` and returns:

- `colorScheme`, `themeParams`
- `isDark`, `isLight`
- convenience colors such as `bgColor`, `textColor`, `buttonColor`
- `cssVariables` with `--tg-theme-*` keys ready for inline style injection or CSS-in-JS

## Example

```tsx
import { useTelegram, useTheme } from "@teleforge/web";

export function Screen() {
  const { user, viewportHeight } = useTelegram();
  const { bgColor, textColor, cssVariables, isDark } = useTheme();

  return (
    <section
      style={{
        ...cssVariables,
        backgroundColor: bgColor,
        color: textColor,
        minHeight: viewportHeight
      }}
    >
      <h1>{isDark ? "Dark" : "Light"} Theme</h1>
      <p>{user ? `Hello ${user.first_name}` : "Running outside Telegram"}</p>
    </section>
  );
}
```

## Verification

```bash
pnpm --filter @teleforge/web test
```
