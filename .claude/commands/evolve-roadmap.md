---
description: Turn a decision into an ADR + new roadmap packages (plan, don't implement).
argument-hint: <the decision to capture>
---
Read `.ai/prompts/evolve-roadmap.prompt.md` in full and execute it **exactly** — write the ADR (`docs/adr/`), then derive well-formed packages per `.ai/agents/roadmap-phase-schema.md` (findings/acceptance/verify/spec/tests, detail bar), wire them into the right epic folders + INDEX, and run `pnpm check:roadmap`. Plan only — do not implement.

The decision to capture: $ARGUMENTS
