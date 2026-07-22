---
id: P263
title: "Per-User-State: Store-Scope-Option `per-user` (Key = user.id statt clientId) für geräteübergreifenden Zustand"
epic: aspects/auth
status: deferred
deferred_reason: "Koppelt an P210 (per-client-State Persistenz/Skalierung/TTL) — Scope-Erweiterung und Speicher-Frage gehören zusammen entschieden; erst nach P261 sinnvoll und nicht 1.0-kritisch."
dependencies: [P261]
verify: browser
spec: docs/nodes/state/ui-store.md
tests: tests/e2e/nodes/state/ui-store.tests.md
---
# P263 — Per-User-State (deferred)

`ui-store.scope` um `per-user` erweitern: Zustand keyed auf `user.id` (ADR 0041
Contract) statt `clientId` — derselbe User sieht seinen Zustand auf jedem Gerät.
Wechselwirkungen (bei Aktivierung im ADR-Nachtrag zu klären): Verhältnis zu
`client-only`/`broadcast-only`-Scope-Regeln (ui-store-read/-action, P209/P211),
SSE-Fanout an alle Verbindungen desselben Users, Speicher/TTL (P210).
