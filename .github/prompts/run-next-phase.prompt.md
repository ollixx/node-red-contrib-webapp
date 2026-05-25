---
name: Run Next Phase
description: "Execute the next ready roadmap phase for node-red-contrib-webapp using the roadmap orchestrator."
agent: "Roadmap Orchestrator"
---
Execute the next ready phase from [docs/agent-roadmap.yaml](../../docs/agent-roadmap.yaml).

Requirements:

- Read [prd.md](../../prd.md), [docs/implementation-plan.md](../../docs/implementation-plan.md), [docs/agent-roadmap.yaml](../../docs/agent-roadmap.yaml), and [AGENTS.md](../../AGENTS.md) first.
- Select the first phase whose dependencies are complete and whose status is not `done`.
- Implement only that phase.
- Run the validation needed for that phase.
- Update the phase status in the roadmap.
- Stop after that single phase and report the next ready phase.