---
id: P259
title: "Id-Suffix-Referenz-Renames: layoutId→layout (route/dialog/container), routeId→route (dialog/action), definitionId→definition (component-instance) — back-compat; check:fields-Allowlist → LEER"
epic: aspects/editor
status: pending
dependencies: [P228]
verify: browser
spec: docs/nodes/concepts/field-conventions.md
tests: tests/e2e/nodes/editor/field-naming.spec.ts
---
# P259 — Id-Suffix-Renames (Abschluss der Feld-Modell-Einfrierung)

> Rationale: [ADR 0038](../../../adr/0038-field-model-consistency-naming-and-carrier-normalization.md)
> Regel (c): Referenz-Felder tragen den **bare Namen** (der Wert IST die id) —
> wie `store`/`mount`/`app`. Aus dem ursprünglichen P228 ausgegliedert (der
> Erstversuch scheiterte am Beide-Wellen-Big-Bang); nach P229+P228 ist dies der
> **letzte** Zug — danach ist die `check:fields`-Allowlist komplett **leer** und
> das Feld-Modell für 1.0 eingefroren.

## ⚠️ Ausführungs-Auflagen

Identisch zu P228: **Haupt-Checkout, kein Worktree**, Stufen-Commits mit E2E-Gate,
Helpers/Fixtures im selben Commit, `check:roundtrip` nach jeder Stufe grün,
Attempt-Branch `phase/P228` als Karte (`7e6b1a2` war der damalige Id-Rename-Commit).

## findings

Exakte Zielliste = `check:fields`-Allowlist, Regel-(c)-Einträge (6 Felder, 5 Knoten):

| Knoten | Feld (alt) | Feld (neu) | Editor-Control |
|---|---|---|---|
| ui-route | `layoutId` | `layout` | Layout-Preset-SelectBox (`installLayoutSelector`) |
| ui-dialog | `layoutId` | `layout` | dito |
| ui-container | `layoutId` | `layout` | dito |
| ui-dialog | `routeId` | `route` | Route-Picker (`installReferenceSelectors({route:true})`) |
| ui-action | `routeId` | `route` | Route-Picker (Navigate-Modus; Validator `validateNavigateConfig`) |
| ui-component-instance | `definitionId` | `definition` | Definition-Picker |

Anmerkungen:
- Das **Schema** heißt bei route/dialog/container schon `layout` (mapConfig
  übersetzt `layoutId→layout`) — hier ist nur Editor+mapConfig+Spec zu drehen; bei
  `routeId`/`definitionId` heißt auch das Schema noch mit Suffix.
- `selectedId` (ui-list) und `uiId` bleiben — dokumentierte Keep-List
  (Wert bzw. Eigen-Id, keine Knoten-Referenz).
- `ui-action.routeId` speist die Navigate-Validierung — der Validator und der
  P119-Mode-Umschalter (`installNavigateTargetMode`) lesen das Feld.

## acceptance

**Je Feld dieselbe Vier-Schritt-Mechanik wie P228** (Runtime liest beide → Helpers/
Fixtures kanonisch → Editor schreibt kanonisch + on-open-Migration → Generatoren/
Specs), gebündelt in zwei Stufen:

**Stufe 1 — `layoutId` → `layout`** (route/dialog/container).
- `installLayoutSelector`-Aufrufe + `defaults` + mapConfig (`layout: config.layout
  || config.layoutId`) + die drei Node-Specs; Roundtrip-E2E je Knoten (Alt-Flow mit
  `layoutId` öffnet mit befülltem Preset, speichert `layout`); bestehende
  layout-abhängige E2E (grid/vertical-Klassen, Dialog-Preset-Slots) bleiben grün.

**Stufe 2 — `routeId` → `route` + `definitionId` → `definition`.**
- Schema-Felder umbenannt (Übergangs-Union akzeptiert alt), mapConfig-Fallback,
  Editor-Picker + Validator (`validateNavigateConfig` liest `route` mit
  `routeId`-Fallback), `defaults`, Specs; Roundtrip-E2E je Feld; die
  ui-dialog-`routeId`-Roundtrip-Spec und die Route-Scoping-E2E (P245) auf `route`
  umgestellt und grün; ui-action-Navigate-E2E (P243-Kanon) grün.

**Gesamt-Beweis (das Ziel des ganzen Zuges):**
- **`check:fields` läuft mit KOMPLETT LEERER Allowlist grün** — kein P228/P229/
  P259-Eintrag mehr. Damit ist ADR 0038 vollständig durchgesetzt.
- Pre-Rename-Fixtures (mit `layoutId`/`routeId`/`definitionId`) laden, rendern
  unverändert, migrieren on-save (E2E in `field-naming.spec.ts`).
- Volle E2E-Suite + `pnpm validate` + alle Tripwires grün im Haupt-Checkout.
- `examples/**` regeneriert (Generatoren emittieren die neuen Namen).

## verify

`browser` — Roundtrips je Feld gemessen; layout-/dialog-/navigate-Verhalten
unverändert; leere `check:fields`-Allowlist als hartes Abschluss-Kriterium.

## spec

`docs/nodes/concepts/field-conventions.md` (bare-Name-Regel als abgeschlossen),
`editor.md`, die 5 betroffenen Node-Specs.

## tests

`tests/e2e/nodes/editor/field-naming.spec.ts` (erweitert um die 6 Felder) +
angepasste bestehende Roundtrip-/Verhaltens-Specs.

## notes for the implementer

- Klein genug für einen Zug, aber die **Stufen-Disziplin trotzdem einhalten** —
  `ui-action.routeId` hängt am Navigate-Validator (P119/P243-Territorium), dort
  zuerst den Fallback-Leser, dann den Schreiber drehen.
- `ui-dialog` wird in Stufe 1 UND 2 angefasst — die Stufen nacheinander, nicht
  parallel, damit die Dialog-Specs nie zwei Baustellen gleichzeitig haben.
- Nach Abschluss: Regel (c) in `check-fields.js` bleibt scharf OHNE Allowlist —
  jedes künftige `*Id`-Referenzfeld wird sofort geflaggt.
