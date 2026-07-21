---
id: P256
node: ui-action
title: "Konformitäts-Pass ui-action (leicht) — Verben `focus`/`reset`/`select` ungetestet (Existenz zu verifizieren); übrige Verben + navigate solide"
epic: aspects/node-conformance
status: done
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

## Result

**Done 2026-07-20.** Alle drei Verben **gegen das echte DOM gemessen**; jedes ist
aufgelöst (getestet bzw. Owner-Entscheid + Umsetzungspfad).

### `focus` → funktioniert → getestet (grün)

`ui-action(focus)` auf ein `ui-input` setzt den Tastatur-Fokus auf das Control
(`sl-input` wird `document.activeElement`). Bereits implementiert (Client
`applyCommand` case `"focus"` → `.focus()` am inneren Control; Server-`ui-input`/
`ui-textarea`/`ui-datepicker` besitzen das Verb). Neuer grüner Lock in
`tests/e2e/nodes/behavior/p256-verbs-focus-reset-select.spec.ts`.

### `select` → gemessen INERT → Owner: **implementieren** → **P257**

Das Command wird gepusht, aber der Client löst `part` via `[name="<part>"]` auf →
trifft den `sl-tab-panel`-Body statt des aktivierenden `sl-tab`-Nav-Elements; kein
Tab-Wechsel. Echtes `select` spannt tabs/stepper/menu/table (je Aktivierungs-Semantik
+ Serializer-Hook) → substanziell, als eigenes Feature-Paket **P257** ausgekoppelt
(Owner-Entscheid 2026-07-20). Der Test liegt als lauffähiger `test.fixme` vor.

### `reset` → gemessen INERT → Owner: **implementieren** → **P258**

Das Command wird gepusht, aber der Client löscht nur open/selected-Overlay-Flags,
setzt nie einen Feld-**Wert** zurück (getippter Input behielt „scratch"). „Reset auf
Initialwert" hat pro Ziel-Typ verschiedene Semantik (offene Frage) → eigenes Paket
**P258** (mit Owner-Entscheid zur Initialwert-Quelle). Test als `test.fixme`.

### Warum P257/P258 statt inline

P256 war als **leichter** Konformitäts-Pass geschnitten; select (4 Knoten, Serializer-
Hooks) + reset (Wert-Reset über ~8 Form-Controls, offene Semantik) sind cross-node-
**Feature**-Arbeit. Sauber als Folge-Pakete geschnitten (Muster: P240-Findings →
Folge-Pakete), mit dem gemessenen Befund + konkreter Akzeptanz als Startpunkt — kein
Raten, kein stilles Entfernen eines dokumentierten Verbs.

### Verifikation

Der P256-Anteil ist **test-only** (1 grüner focus-Test + 2 `test.fixme` + Katalog,
kein geteilter Code) → gezielter Lauf: `p256-verbs-focus-reset-select.spec.ts`
**1 passed, 2 skipped, `--retries=0`**. Kein Regress möglich (keine Impl.-Änderung).
`pnpm validate` + Tripwires grün. Agent committete VOR der Verifikation, stoppte alle
Prozesse (Port 1882 frei). (Der erste Versuch starb an einem Verbindungsfehler in der
Mess-Phase ohne Commit — verlustfrei neu gestartet.)
