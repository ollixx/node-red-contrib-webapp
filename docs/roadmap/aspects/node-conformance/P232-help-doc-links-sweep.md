---
id: P232
title: "Node-Konformität (Sweep): Voll-Doku-Link in JEDEN Inline-Hilfe-Block (data-help-name) — ~12 Knoten fehlt er"
epic: aspects/node-conformance
status: in_progress
dependencies: []
verify: browser
spec: docs/nodes/concepts/editor.md
tests: tests/e2e/nodes/editor/help-docs-link.spec.ts
---
# P232 — Sweep: Voll-Doku-Link in alle Inline-Hilfen

> Aus dem Audit-Sweep (2026-07-14, Node-Konformitäts-Programm). Cross-Cutting-
> Cleanup — vor den per-Knoten-Pässen.

## findings

Die Spec-Konvention (§Inline-Hilfe, z.B. ui-alert/ui-divider) verlangt in jedem
`data-help-name`-Block einen **Link auf die Voll-Doku** (`docs/nodes/<cat>/<node>.md`).
Der Sweep zeigt: **~12 Knoten haben keinen** — u.a. ui-progress, ui-container,
ui-icon, ui-repeat, ui-action, ui-app, ui-dialog, ui-log, ui-navigation, ui-table,
ui-toast, ui-component-definition/-instance.

## acceptance

- **Jeder `ui-*`-Knoten** hat in seinem `data-help-name`-HTML-Block einen Link auf
  seine Voll-Doku (Muster: `https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/<cat>/<node>.md`,
  wie in ui-divider/ui-alert). Für Knoten **ohne** eigene Spec (ui-component-*,
  Sonderfall — siehe [epic.md](epic.md)) genügt ein sinnvoller Ziel-Doc-Link
  (z.B. das ui-component-Konzept).
- **Hilfe bleibt knapp** (node-testing/Spec-Konvention): Zweck 1–2 Sätze +
  wichtigste Felder + Link. Keine Redundanz zur Voll-Doku.
- **Browser-Beweis:** die Node-RED-Hilfe-Sidebar jedes betroffenen Knotens zeigt
  den funktionierenden Doku-Link (Playwright: Link vorhanden + href korrekt).
- **Guardrail (leicht):** ein read-only Check (oder Erweiterung von `check:fields`/
  ein kleiner `check:help`) verifiziert, dass jeder `data-help-name`-Block einen
  Doku-Link enthält — damit neue Knoten ihn nicht vergessen.

## verify

`browser` — Hilfe-Panel je Knoten zeigt den Link; plus der Guardrail-Check grün.

## spec

`docs/nodes/concepts/editor.md` — die Inline-Hilfe-Konvention (Zweck + Felder +
Doku-Link) explizit festhalten.

## tests

`tests/e2e/nodes/editor/help-docs-link.spec.ts` — der Guardrail bzw. ein Test, dass
jeder Hilfe-Block einen Doku-Link führt.

## notes for the implementer

- Rein additive Doc/HTML-Änderung; kein Verhaltens-/Feld-Change.
- Link-Muster + Kürze aus `nodes/view/ui-divider.html` / `ui-alert.html` übernehmen.
- Sweep-Liste ist ein Startpunkt — beim Umsetzen ALLE Knoten prüfen (der Check macht
  es danach maschinell verlässlich).
