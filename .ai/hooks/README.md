# Agent-OS hooks

## `record-run-cost.js` — per-run cost trail (AGENTS.md rule 10)

Wired in `.claude/settings.json` as a **`SessionEnd`** and **`SubagentStop`**
hook. When any agent run ends, it reads that run's transcript, sums the token
usage from the per-message `usage` accounting, measures wall-clock duration, and
appends one JSON line to **`.ai/agent-runs.jsonl`**.

Token numbers are real (read from the transcript), not self-estimated. Each line:

```json
{
  "ts": "2026-06-01T17:40:00.000Z",
  "event": "SessionEnd" | "SubagentStop",
  "session_id": "…",
  "model": "claude-…",
  "messages": 42,
  "tokens": { "input": 0, "output": 0, "cache_read": 0, "cache_creation": 0, "total": 0 },
  "duration_s": 1620,
  "duration": "27m 0s",
  "cwd": "/…/node-red-contrib-webapp"
}
```

Correlate a phase to its cost via `session_id` (agents record their session id in
the phase summary). Quick reads:

```bash
# last 5 runs
tail -5 .ai/agent-runs.jsonl | jq -c '{event, session_id, total: .tokens.total, duration}'

# total tokens across all recorded runs
jq -s 'map(.tokens.total) | add' .ai/agent-runs.jsonl
```

A hook must never break the session: every failure path in the script exits 0
and writes nothing.
