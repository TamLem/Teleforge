## 401 Invalid or expired action context on all loader/action requests

**Environment:** Cloudflare Tunnel (`overnight-truth-musical-castle.trycloudflare.com`), dev mode

**Symptom:** Every `loadScreenContext` and `runAction` server bridge request returns HTTP 401 with body `"Invalid or expired action context."`. Both catalog and product-detail screens affected.

**Evidence:**
- Server-side logging confirms the requests arrive with a `tfp2` token (prefix: `tfp2.eyJhbGxvd2VkQWN0aW9ucyI6W`)
- Server logs the request BEFORE `validateActionContext` is called, then the validation returns null and throws 401
- Client browser console shows the POST to `https://overnight-truth-musical-castle.trycloudflare.com/api/teleforge/actions` returning 401

**FlowSecret trace:**
- Both `startTeleforgeBot` and `startTeleforgeServer` receive `flowSecret: context.flowSecret` from `createTeleforgeRuntimeContext({ cwd: projectRoot })`
- In `createTeleforgeRuntimeContext`:
  - `rawFlowSecret = options.flowSecret ?? readEnv("TELEFORGE_FLOW_SECRET")` → no `options.flowSecret` set, falls to env
  - If `TELEFORGE_FLOW_SECRET` is not set → `rawFlowSecret = undefined`
  - `flowSecret = rawFlowSecret ?? `${app.app.id}-preview-secret`` → `"task-shop-preview-secret"`
- Both bot and server should receive this same secret value
- Bot's `createSignForActionContext` uses this secret to sign tokens
- Server's `validateActionContext` uses the same secret to verify

**Suspect:**
1. `validateActionContext` fails on signature check → signing secret != validation secret
2. Token expiry — the token TTL might be shorter than expected
3. Token format issue — the `tfp2` payload might be malformed

**Owner diagnosis:**

The likely concrete cause is a flow ID mismatch for `/start` launches.

`apps/bot/src/flows/start.flow.ts` defines the `/start` command in flow
`gadgetshop-start`, but it launches the `catalog` screen, which belongs to the
`gadgetshop` flow. `sign()` defaults `flowId` to the current flow when the
caller does not provide one. That means `/start` produced a token with:

```ts
flowId: "gadgetshop-start"
screenId: "catalog"
```

The Mini App route `/` resolves to screen `catalog` under flow `gadgetshop`, so
the loader/action bridge sends:

```ts
flowId: "gadgetshop"
screenId: "catalog"
```

The server then calls:

```ts
validateActionContext(signedContext, flowSecret, { flowId: "gadgetshop" })
```

and rejects the otherwise valid token because the signed flow ID is
`gadgetshop-start`.

**Fix applied:**

`apps/task-shop/apps/bot/src/flows/start.flow.ts` now signs the catalog launch
with an explicit target flow:

```ts
const catalogLaunch = await sign({
  flowId: "gadgetshop",
  screenId: "catalog",
  subject: {},
  allowedActions: ["addToCart", "removeFromCart", "placeOrder"]
});
```

This keeps the `/start` command as a separate entry flow while making the signed
Mini App token match the flow that owns the screen and loaders.

**Follow-up framework DX:**

This is a sharp edge in `sign()`: cross-flow screen launches are valid, but the
default `flowId` can silently sign the current handler flow instead of the
screen-owning flow. Future route-aware/generated contract work should make this
harder to misuse, for example by resolving `sign({ screenId })` against known
Mini App routes or by requiring `flowId` when the current flow does not own the
screen.

**To debug further:**
- Decode the base64url payload from the failing token to inspect `issuedAt`, `expiresAt`, and `flowId`
- Add a log in `validateActionContext` to show WHICH check fails (signature vs expiry vs flowId)
- Verify `process.env.TELEFORGE_FLOW_SECRET` is not set (which would override the default)
- Confirm the signing secret used by each sign() call matches the server's validation secret

**Verification request:**

- Restart the dev process so newly signed `/start` buttons include the updated
  flow ID.
- Use a freshly generated `/start` Mini App button; old Telegram messages may
  still contain tokens signed with `flowId: "gadgetshop-start"`.
- Confirm `loadScreenContext` for catalog returns 200.
- Confirm `actions.addToCart(...)` returns 200 from catalog/product detail.
