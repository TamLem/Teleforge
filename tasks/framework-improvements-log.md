# Framework Improvements Log

## Purpose

This log captures follow-up framework improvements after the Mini App/chat state
refactor. It is intentionally broader than one implementation phase: use it for
DX ideas, architectural cleanup, generated contracts, runtime refinements, and
future product supervision notes.

The current framework model is sound:

```text
Chat signs scope and IDs.
The Mini App resolves a route and screen.
The server loader fetches display data.
Screens call actions.* and nav.*.
Actions mutate server-owned state.
```

The remaining work should preserve this model while making it easier to use,
harder to misuse, and clearer in generated contracts.

## Logging Format

Each improvement entry should include:

- **Problem**: what is hard, unsafe, or unclear for framework users
- **Current behavior**: how it works today
- **Proposed improvement**: the intended API or implementation direction
- **Acceptance criteria**: how we know it is done
- **Open questions**: decisions that need product or technical review

Entries should stay framework-level. App-specific fixes belong in app tasks
unless they reveal a reusable framework gap.

---
