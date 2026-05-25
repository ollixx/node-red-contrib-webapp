---
name: Run Roadmap Until Blocked
description: "Continue the node-red-contrib-webapp roadmap phase by phase until human input or a blocking validation failure is required."
agent: "Roadmap Orchestrator"
---
Continue implementing the roadmap from [docs/agent-roadmap.yaml](../../docs/agent-roadmap.yaml) until one of these conditions occurs:

1. a phase becomes blocked
2. a phase requires a new architectural decision
3. validation fails twice for the same phase
4. the MVP roadmap is complete

Execution rules:

- Read [prd.md](../../prd.md), [docs/implementation-plan.md](../../docs/implementation-plan.md), [docs/agent-roadmap.yaml](../../docs/agent-roadmap.yaml), and [AGENTS.md](../../AGENTS.md) first.
- Work strictly in dependency order.
- Run the quality gate after each phase.
- Update roadmap status after every phase transition.
- Return a concise summary with completed phases, blocked phase if any, and the exact human decision needed to continue.