# Teleforge Documentation

These docs are organized around how developers ask questions, not around framework internals.

The learning path is:

1. **What is Teleforge?** -> Learn
2. **How does the runtime wire everything together?** -> Learn
3. **How do I build a feature?** -> Build
4. **What API do I use when I need exact types?** -> Reference
5. **How do I test, deploy, and debug?** -> Operate

Pick a path below. If you are new, start at the top of Learn and read down.

---

## Learn: The Mental Model

Read these before you touch APIs.

1. [Telegram Mini App Basics](./telegram-basics.md): plain-language primer on Mini Apps, `initData`, launch modes, `web_app_data`, and BotFather
2. [Framework Model](./framework-model.md): what Teleforge is, core concepts, and the flow-first authoring model
3. **[Runtime Wiring](./runtime-wiring.md)**: the complete chain from `sign()` through route resolution, screen props, loaders, actions, and generated artifacts
4. [State Boundaries](./state-boundaries.md): trust model, state categories, session resources, storage architecture, and security properties

> **Why read Runtime Wiring third?** Because it answers the questions that stop new developers: what does `sign()` create, why are screen props injected, which data is server-trusted, and what files are generated vs. authored.

---

## Build: Hands-On Guides

Use these when you are writing code.

- [Getting Started](./getting-started.md): fastest path from clone to a working Teleforge app
- [Developer Guide](./developer-guide.md): setup, daily workflow, public imports, and common patterns
- [Build Your First Feature](./first-feature.md): guided command and screen tutorial
- [Flow Coordination](./flow-coordination.md): chat to Mini App to chat lifecycle tutorial
- [Generated Mini App Contracts](./generated-miniapp-contracts.md): typed `nav.*`, `actions.*`, `loaderData`, and app-authored overrides
- [Server Hooks](./server-hooks.md): trusted server-backed flow hooks and the default Mini App server bridge
- [Shared Phone Auth](./shared-phone-auth.md): phone-number auth using bot contact sharing
- [Mini App Architecture](./miniapp-architecture.md): frontend rules for screens, lazy loading, and Telegram-specific behavior

---

## Reference: Exact API and Config

Use these when you need a signature, field list, or type shape. These pages do not teach concepts — they provide exact details.

- [Config Reference](./config-reference.md): `teleforge.config.ts`, `defineFlow()`, `defineLoader()`, `defineScreen()`, discovery conventions, and environment variables
- Generated TypeDoc API: build with `pnpm docs:build`, open at `dist/docs-site/api/index.html`

---

## Operate: Production and Debugging

Use these when you are running, testing, or deploying.

- [Testing](./testing.md): test layers, type-level contract tests, simulator workflow, and framework test helpers
- [Deployment](./deployment.md): production build, hosting, polling vs webhook, split processes, and rollout checklist
- [Environment Variables](./environment-variables.md): central reference for app and devtools env vars
- [Troubleshooting](./troubleshooting.md): common local-dev, validation, route, and server-hook failures

---

## Examples

- [Starter App](../examples/starter-app/README.md): smallest runnable example
- [Task Shop](../apps/task-shop/README.md): full reference app with chat/Mini App coordination

---

## Suggested Reading Sequences

### New to Teleforge

1. [Telegram Mini App Basics](./telegram-basics.md)
2. [Framework Model](./framework-model.md)
3. [Runtime Wiring](./runtime-wiring.md)
4. [Getting Started](./getting-started.md)
5. [Build Your First Feature](./first-feature.md)

### Building a Feature

1. [Runtime Wiring](./runtime-wiring.md)
2. [Build Your First Feature](./first-feature.md)
3. [Flow Coordination](./flow-coordination.md)
4. [Generated Mini App Contracts](./generated-miniapp-contracts.md)
5. [Server Hooks](./server-hooks.md)

### Debugging

1. [Runtime Wiring](./runtime-wiring.md)
2. [Troubleshooting](./troubleshooting.md)
3. [Config Reference](./config-reference.md) as needed

### Deploying

1. [Getting Started](./getting-started.md)
2. [Environment Variables](./environment-variables.md)
3. [Deployment](./deployment.md)
4. [Testing](./testing.md)
