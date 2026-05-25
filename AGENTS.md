# Project Guidelines

## Working Mode

- This repository is plan-first until the initial scaffold exists.
- Read [prd.md](prd.md), [docs/implementation-plan.md](docs/implementation-plan.md), and [docs/agent-roadmap.yaml](docs/agent-roadmap.yaml) before making implementation changes.
- Work on exactly one roadmap phase at a time.
- Update roadmap status in [docs/agent-roadmap.yaml](docs/agent-roadmap.yaml) whenever a phase starts, completes, or becomes blocked.

## Architecture Defaults

- Build the project as a TypeScript workspace.
- Keep shared contracts in a dedicated package so editor, runtime, and renderer use the same schema.
- Treat the UI registry as the source of truth for rendered structure.
- Keep structure, runtime event flow, and editor UX in separate modules.

## Delivery Rules

- Prefer small, phase-aligned changes over broad scaffolding with unclear ownership.
- Validate each phase with runnable checks before marking it done.
- If a phase uncovers an unresolved architecture decision, write it down and stop instead of guessing.
- Keep the CRUD example app current with the MVP as soon as runtime and renderer pieces exist.