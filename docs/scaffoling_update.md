Scaffolding vs Task Shop — Alignment Review
What matches
Aspect Scaffold
Workspace layout apps/bot, apps/api, apps/web
Config teleforge.config.ts with flows.root, miniApp.entry, bot.username, webhook
Bot entry createDiscoveredBotRuntime, polling bot, preview fallback, bindBot, setCommands
Bot runtime createGeneratedBotRuntime → createDiscoveredBotRuntime({ cwd, flowSecret, miniAppUrl })
Flow definition defineFlow({ id, initialStep, state, bot.command, miniApp, steps })
Web entry TeleforgeMiniApp with flows + screens arrays
Screen definition defineScreen({ component, id, title })
Web SDK <script src="telegram.org/js/telegram-web-app.js"> in index.html
Env loading loadWorkspaceEnv resolves 3 levels up, loads .env / .env.local
What diverges

1. Flow step uses component instead of screen
   Scaffold (line 710):
   miniApp: {
   component: "screens/home", // ← old V1-style
   route: "/"
   }
   Task Shop:
   miniApp: {
   route: "/",
   stepRoutes: { cart: "/cart", checkout: "/checkout" }
   }
   Steps use screen: "task-shop.catalog" (string screen ID), not component.
2. Scaffold flow step uses screen: "home" — no type
   Scaffold (line 716):
   steps: {
   home: {
   screen: "home",
   type: "miniapp"
   }
   }
   This is correct — type: "miniapp" is present. But the miniApp.component field above is dead/legacy.
3. Scaffold doesn't wire a server bridge
   Scaffold main.tsx (line 811-826):
   <TeleforgeMiniApp flows={[startFlow]} screens={[homeScreen]} />
   Task Shop:
   const serverBridge = createFetchMiniAppServerBridge();
   <TeleforgeMiniApp flows={...} screens={...} serverBridge={serverBridge} />
   Without a server bridge, the scaffold can't do chat handoff, server-side guards/loaders, or submit validation. This is fine for a minimal starter but means the scaffold doesn't demonstrate the full flow-first architecture.
4. Scaffold doesn't pass chatId to startInstance
   The scaffold's flow has type: "miniapp" as the entry step, so it never goes through the chat command handler that calls startInstance. The chatId bug we fixed in the real runtime wouldn't manifest here — but it also means the scaffold doesn't test the chat → miniapp handoff path at all.
5. Scaffold API is a placeholder, not a hooks server
   Scaffold apps/api/src/index.ts exports raw route objects (healthRoute, webhookRoute). Task Shop's API runs createDiscoveredServerHooksHandler with storage and onChatHandoff. The scaffold doesn't demonstrate server hooks at all.
6. Scaffold has no stepRoutes
   The scaffold generates a single-step flow. Task Shop uses stepRoutes to map step IDs to URL paths. The scaffold should at least show a two-step flow to demonstrate this.
7. Scaffold miniApp.component field is legacy
   Line 710 uses component: "screens/home" which was a V1 convention. The current framework uses steps.{stepId}.screen as a screen ID string (e.g., "home"), resolved via the screen registry. This field is likely ignored by the runtime but creates confusion.
   Summary
   The scaffold is structurally sound — workspace layout, config shape, bot boot sequence, and screen/flow APIs all match Task Shop. The gaps are:

- miniApp.component is a dead legacy field
- No server bridge wiring (no handoff, no server hooks demo)
- Single-step flow doesn't demonstrate stepRoutes, transitions, or chat handoff
- API app is a raw route placeholder, not a hooks server
