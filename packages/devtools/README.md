# `packages/devtools`

Internal Teleforge implementation layer for CLI, simulator, doctor checks, and tunnel support.

App authors use the CLI from the unified `teleforge` package:

```bash
teleforge dev
teleforge dev --public --live
teleforge doctor
teleforge mock
```

This workspace package remains separate so framework maintainers can test local tooling independently.
