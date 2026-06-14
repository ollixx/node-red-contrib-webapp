---
id: P180
node: ui-list
epic: nodes/ui-list
title: "ui-list: displayType als semantisches Intent-Enum (plain/divided/grouped/actionable) + ordered (ul/ol); Shoelace-Mapping inkl. grouped Kasten-Look"
findings:
  - "Owner (2026-06-14): 'Ich sehe jetzt ui-list in shoelace als UL/LI tags. Das ist nicht so richtig befriedigend.' Vorstellung: eher die Bootstrap-Lösung, die Listen als kastenförmige explizite Abschnitte rendert; eine einfache HTML-Liste ist aber auch nicht abwegig."
  - "Owner (2026-06-14): Stil-Durchschlag des Backends; je Backend unterschiedliche Optionen gewünscht (Shoelace z.B. UL/OL/tabellarisch als ENUM)."
  - "Owner-Entscheidung (2026-06-14): semantische Intents JETZT (backend-neutral, je Backend gemappt); backend-spezifische Optionssätze später via P102 (ADR 0020)."
acceptance:
  - "displayType ist ein semantisches Intent-Enum: plain | divided | grouped | actionable (Default: plain — kompatibel zum heutigen Look). Migration: alt default→plain, divided→divided, compact→plain (Dichte separat, s.u.)."
  - "grouped rendert den Kasten-/list-group-Look: jede Zeile eine umrandete Zelle, die Liste als kartenartiger Container (Shoelace-Adapter-Mapping)."
  - "actionable rendert klick-/hover-bare Zeilen (paart mit itemClick/selectable); plain/divided wie bisher."
  - "ordered (Boolean, Default false) schaltet ul↔ol (geordnete Liste) — backend-neutral."
  - "Das Mapping liegt im Shoelace-Adapter (renderer/shoelace-adapter bzw. webapp-serializer), NICHT als backend-spezifischer Enum im Editor; ein späterer 2. Backend mappt dieselben Intents anders (kein Editor-Backend-Zweig hier)."
  - "Abgrenzung dokumentiert: ui-list = gestylte Zeilen aus einem Daten-Array; ui-repeat = beliebiger Subtree ×N; ui-table = Spalten. 'tabellarisch' ist KEINE ui-list-Option (→ ui-table)."
verify: browser
spec: docs/nodes/display/ui-list.md
tests: tests/e2e/nodes/view/ui-list.tests.md
dependencies: []
status: pending
---
# P180 — ui-list: semantische displayType-Intents

> Setzt [ADR 0020](../../../adr/0020-display-intents-semantic-backend-mapped.md)
> auf ui-list um: der Look wird ein **semantischer Intent**, je Backend gemappt —
> kein backend-spezifischer Editor-Enum (das wartet auf P102 + 2. Backend). Gibt
> dir den **Kasten-Look (`grouped`) sofort**, ohne Shoelace einzubrennen.

## Umfang

1. **`displayType`-Vokabular** (SelectBox): `plain` | `divided` | `grouped`
   (Kasten/list-group) | `actionable` (klickbare/hover-Zeilen). Default `plain`
   (heutiges Verhalten, rückwärtskompatibel). **Migration** der Alt-Werte:
   `default→plain`, `divided→divided`, `compact→plain` (+ Dichte, s. 4).
2. **Shoelace-Mapping** im Serializer/Adapter: `grouped` → umrandete Zellen +
   kartenartiger Container; `actionable` → Hover/Fokus-Affordanz; `plain`/
   `divided` wie bisher. **Eine** Mapping-Stelle, kein Editor-Backend-Zweig.
3. **`ordered`** (Boolean, Default `false`): `ul` ↔ `ol`. Backend-neutral.
4. **Dichte (Sub-Entscheidung):** der alte `compact` war Dichte, kein Look. Als
   separater Modifier modellieren (z. B. `density: comfortable|compact`) **oder**
   vorerst weglassen und nur migrieren — im Paket entscheiden, nicht raten;
   Default = heutige Dichte.
5. **Abgrenzung** in der Spec (Besonderheiten) schärfen: list vs repeat vs table.

## Spec / Tests

- Spec: `displayType`-Tabelle + Theming-Abschnitt auf die Intents ziehen; ADR 0020
  verlinken; die ui-list↔ui-repeat↔ui-table-Abgrenzung explizit machen.
- Tests: je Intent ein Render-Nachweis (grouped = Kästen sichtbar; actionable =
  Hover/Klick-Affordanz; ordered = `<ol>`); Migration der Alt-Werte.

## acceptance / verify

- `verify: browser` — die Looks im laufenden Frontend belegen (grouped sichtbar
  kastenförmig); E2E im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]).

## Risiken / Hinweise

- **Kein** backend-spezifischer Enum im Editor (ADR 0020 §2) — nur semantische
  Intents. Wer Shoelace-Spezifika will, wartet auf P102.
- Default-Look = `plain` für Kompatibilität; ob `grouped` der bessere Default für
  „eine Liste sieht aus wie eine Liste" ist, ist eine **Owner-Sub-Entscheidung**
  (hier konservativ `plain`, leicht umstellbar).
