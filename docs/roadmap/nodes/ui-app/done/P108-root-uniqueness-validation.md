---
id: P108
title: "ui-app: root-Eindeutigkeit beim Deploy validieren (heute nur id-Eindeutigkeit, nicht root)"
epic: nodes/ui-app
status: done
dependencies: [P109]
node: ui-app
verify: browser
spec: docs/nodes/structure/ui-app.md
---
# P108 — ui-app: root-Eindeutigkeit validieren

## Findings
> Review-Befund (2026-06-09), gegen den Code verifiziert.

- Die Doc sagt zu, `root` sei „eindeutig über alle ui-app-Knoten" ([ui-app.md](../../../../nodes/structure/ui-app.md) Felder/„Besonderheiten"). **Durchgesetzt wird das nicht:** die Registry dedupliziert `duplicate-app` nach `definition.id` ([registry.ts:266-268](../../../../../packages/runtime/src/registry.ts)), nicht nach `root`. Zwei Apps mit unterschiedlicher id aber gleichem `root` erzeugen **keinen** Diagnostic — kollidieren aber auf der URL `/<root>` und beim appId-Match ([webapp.js:1786](../../../../../nodes/webapp.js), `entry.id === appId || entry.root === appId`, „first match wins"), was nichtdeterministisch die falsche App auflöst.

## Acceptance
> `verify: browser` — im laufenden Editor/Deploy zu beweisen.

- Registry: zwei `ui-app`-Definitionen mit gleichem `root` (verschiedene id) erzeugen einen strukturierten Diagnostic (z. B. `duplicate-app-root`) mit beiden Knoten-IDs. Unit-Test in `packages/runtime` (analog zum bestehenden `duplicate-app`/`duplicate-route-path`).
- Editor/Deploy: der Konflikt wird sichtbar (Knoten rot / Deploy-Warnung), nicht still verschluckt.
- Gegenprobe: zwei Apps mit **unterschiedlichem** `root` lösen **keinen** Diagnostic aus.
- Doc: ui-app.md bleibt korrekt (root eindeutig) — jetzt auch durchgesetzt.

## Notes
- `root` muss dafür im Modell verlässlich vorhanden sein — daher Dependency auf **P109** (Gap 2: `root` ins `uiAppNodeDefinitionSchema`).
- Bestehende Diagnostics als Vorlage: `duplicate-app`, `duplicate-id`, `duplicate-route-path` ([registry.ts:60-62](../../../../../packages/runtime/src/registry.ts)).

## Result

delivered:
- `packages/runtime/src/registry.ts`: `AppContribution.definition` carries `root?: string`; `RuntimeDiagnostic.code` gains `"duplicate-app-root"`; `RuntimeRegistry.compile()` performs cross-app root-uniqueness check — emits `duplicate-app-root` when two apps share the same root with different ids
- `nodes/webapp.js`: new `validateAppRootUniqueness(RED)` function (mirrors `validateNavigationFlow` pattern); called in `flows:started` hook; logs as structured `reportRuntimeError`
- `packages/runtime/test/p108-root-uniqueness.test.ts`: 4 unit tests — conflict detected, no false positives for distinct roots, no false positives when root absent, message content

stats: 3 files changed (+218 / -2 lines); 4 new tests; 803 runtime tests all pass; `pnpm validate` clean
notes: Cross-app check runs inside `compile(appId)` querying `this.contributions` directly, bypassing per-app filter — self-contained, no new public API.
cost: session agent-a939ebde179621add, ~5m
