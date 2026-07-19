---
id: P256
node: ui-action
title: "Konformitäts-Pass ui-action (leicht) — Verben `focus`/`reset`/`select` ungetestet (Existenz zu verifizieren); übrige Verben + navigate solide"
epic: aspects/node-conformance
status: pending
dependencies: []
verify: browser
spec: docs/nodes/behavior/ui-action.md
tests: tests/e2e/nodes/behavior/ui-action.tests.md
---
# P256 — Konformitäts-Pass ui-action (leicht)

> Audit 2026-07-17. ui-action ist zentral und **stark abgedeckt** — 8 E2E:
> `hide`/`show`, `disable`/`enable`, `open`/`close` (Dialog), open+target/part
> (Accordion-Sektion), `navigate`, openDialog/closeDialog, Persistenz über
> Snapshot-Push. Katalog vorhanden, Doku-Link korrekt. Ab jetzt (ADR 0040/P243)
> auch der **alleinige** Navigations-Knoten.

## findings

### A. Verben `focus` / `reset` / `select` ungetestet
Das `actionType`-Vokabular umfasst `close`/`disable`/`enable`/`focus`/`hide`/
`navigate`/`open`/`reset`/`select`/`show`. Die E2E decken **7** davon; **`focus`,
`reset`, `select` sind nicht per Verhaltens-E2E belegt**, und ihre Handler waren
im schnellen Audit nicht eindeutig lokalisierbar. **Zu verifizieren pro Verb:**
existiert ein beobachtbarer Effekt (`focus` → Element fokussiert; `reset` →
Formularfeld/Komponente zurückgesetzt; `select` → Auswahl/Selektion gesetzt)?
Wo ja → Verhaltens-E2E ergänzen; wo nein → aus dem `actionType`-Enum + Spec entfernen.

### B. Solide (nicht neu aufbauen)
show/hide, enable/disable, open/close (+target/part), navigate (jetzt kanonisch),
Persistenz über Re-Render, openDialog/closeDialog-Aliase.

## acceptance
- **`focus`/`reset`/`select` aufgelöst:** je ein gemessener Verhaltens-E2E
  (Verb → beobachtbarer DOM-Effekt) — oder das Verb ist aus `actionType` (Schema) +
  Editor-SelectBox + Spec entfernt (kein Verb-Vokabular ohne Wirkung).
- **Katalog** `ui-action.tests.md` spiegelt die neuen Tests.
- **E2E grün** (Haupt-Checkout); Tripwires + `pnpm validate` grün.

## verify
`browser` — die drei Verben gemessen; die 8 bestehenden bleiben grün.

## spec
`docs/nodes/behavior/ui-action.md` — die drei Verben mit beobachtbarer Wirkung oder entfernt.

## tests
`tests/e2e/nodes/behavior/ui-action-verbs.spec.ts` + Katalog.

## notes for the implementer
- Verb-Dispatch sitzt client-seitig (Interaction-Verben) — im Client-Bundle prüfen,
  nicht nur an mapConfig.
- `navigate` ist seit P243 der einzige Navigations-Pfad — dessen Coverage nicht schwächen.
