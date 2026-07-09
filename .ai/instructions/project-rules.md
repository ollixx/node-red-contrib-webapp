# Project Rules
<!-- generic — candidate for agent-os repo -->

These rules apply to all agent runs in this repository.

1. Read `AGENTS.md` before any change or answer.
2. Never overwrite user changes unless explicitly asked.
3. Minimal-invasive patches only — no unrequested reformatting, restructuring, or position changes.
4. Flow files: `.node-red-dev/flows.json` is the owner's personal dev environment — agents **MAY READ it** (owner-authorised 2026-07-08, e.g. to diagnose a flow the owner points at) but must **NEVER write, edit, or regenerate it** (not even via `pnpm gen:example`). `examples/customers-crud/flow.json` is **generated** by `pnpm gen:example` — do not hand-edit it; change only exactly what is asked and regenerate. See `.ai/instructions/flow-files.instructions.md`.
5. If a workflow in `AGENTS.md` requires commits or validation, notify the user immediately on any deviation.
6. If it is unclear whether an existing change was intentional: stop and ask rather than assume.
