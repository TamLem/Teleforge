# teleforge

## 0.5.0

### Major Changes

Teleforge 0.5.0 is the first public release. This version consolidates all framework capabilities into a single npm package and introduces the complete action-first authoring model.

#### One public package

- **Single install**: `pnpm add teleforge`
- **No separate internal packages**: `@teleforgex/core`, `@teleforgex/bot`, `@teleforgex/web`, `@teleforgex/devtools` are now bundled internally
- **Public subpath exports**: `teleforge/web`, `teleforge/bot`, `teleforge/core/browser`, `teleforge/server-hooks`, `teleforge/test`

#### Action-first flow model

```ts
defineFlow({
  id: "start",
  command: { command: "start", description: "...", handler: async ({ ctx, sign }) => { ... } },
  miniApp: { routes: { "/": "home" }, defaultRoute: "/", title: "..." },
  actions: { navigate: { handler: async () => { ... } } }
})
```

#### Signed Mini App launch context

- `sign({ flowId, screenId, subject, allowedActions })` creates HMAC-secured launch URLs
- Server validates token signature, expiry, and action authorization
- No server-side step tracking required

#### Server-backed screen loaders

- `defineLoader({ handler: async () => { return { data } } })`
- Typed loader data via generated contracts
- Loader state: `loading | ready | error | idle`

#### Explicit screen runtime props

- `defineScreen<HomeScreenProps>({ id, title, component })`
- Generated contracts provide: `loader`, `loaderData`, `actions`, `nav`, `screenId`, `routeParams`
- Full type safety for screen components

#### Typed generated contracts

- `HomeScreenProps` with loader data, action helpers, navigation helpers
- `StartNav` with route helpers
- `StartActions` with typed action payloads
- `TeleforgeActionPayloadOverrides` for custom payload shapes

#### Session resource helpers

- `SessionResourceHandle` for secure resource access
- `createSignedActionContext` for server-side action execution

#### Development tools

- `teleforge dev` — local simulator with chat, Mini App, fixtures
- `teleforge doctor` — config, manifest, and environment diagnostics
- `teleforge generate client-manifest` — typed contract generation

#### Modern scaffold

- `teleforge create my-app`
- One flow, one screen, one action, one loader
- Generated contracts with type safety
- Default polling mode, no webhook/env noise
