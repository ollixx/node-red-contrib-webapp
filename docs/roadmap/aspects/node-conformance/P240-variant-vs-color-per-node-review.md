---
id: P240
title: "Review: variant-vs-color pro Knoten — ist die semantische Trennung sauber, und trägt sie ein zweites Backend?"
epic: aspects/node-conformance
status: pending
dependencies: [P238]
verify: unit
spec: docs/nodes/concepts/field-conventions.md
tests: tests/e2e/nodes/view/ui-icon.tests.md
---
# P240 — Review: variant-vs-color pro Knoten (backend-getrieben)

> Rationale: **[ADR 0039](../../../adr/0039-colour-field-model-color-is-tokens-plus-any-colour-variant-is-the-reduction.md)**
> §3. Setzt [ADR 0015](../../../adr/0015-common-base-fields-and-editor-structure.md)
> §1/§3 (Exklusivität; N/A node-lokal) durch. Liefert genau die Evidenz, die
> **P102** (Capability-Map, `deferred`) später konsumieren würde.

## findings

Der Owner (2026-07-17):

> „aber prüfen, ob ein anpassen auch in allen anderen knoten sinn macht. Feld
> ‚Variant' ist ja die reduktion auf die üblichen Theme tokens. Color bietet dann
> die Tokens und darüber alle farben. Bin nicht sicher, ob diese semantische
> Unterscheidung in den Knoten sauber getrennt ist."

> „es sollte geprüft werden, ob variant oder color sinn macht und vor allem ist das
> sehr relevant, wenn wir andere Backends haben und die elemente aus dem backend
> nicht beides unterstützen."

**Gemessener Ist-Zustand (Audit 2026-07-17):**
- **10 Knoten** tragen `variant` mit **per-Knoten unterschiedlicher Vokabel**:
  `CONTAINER_VARIANTS`, `TEXT_COLOR_VARIANTS`, `BUTTON_VARIANTS`, `INPUT_VARIANTS`,
  `SEVERITY_VARIANTS`, ui-tabs `["line","contained","pills"]`.
- **`variant` ist nicht überall Farbe:** `BUTTON_VARIANTS` enthält `ghost`/`link`,
  ui-tabs `line`/`contained`/`pills` — Ausprägungen, die eine Farbe **nicht**
  ausdrücken kann. Die Merkregel „variant = Farbe" hält also nur ungefähr.
- `variant: true` im Base-Field-Helper erzwingt `color` → N/A („uses semantic
  Variant", ADR 0015 §1) — die Exklusivität ist implementiert, aber **welcher**
  Knoten welche Seite bekommt, ist nie gegen Backend-Fähigkeiten geprüft worden.
- ui-icon war der Beleg, dass die Zuordnung driften kann, ohne dass es auffällt
  (P238: plain-string-`color`-Override, nicht bindbar).
- **P102** (schemagetriebene Capability-Map + Editor-Warnung) ist `deferred`:
  „*Ohne ein zweites, real renderndes Backend ist die Capability-Map einspaltig*".
  Dieses Review **wartet nicht darauf** — es erzeugt die per-Knoten-Evidenz in der
  node-lokalen Form (ADR 0015 §3), die P102 später absorbieren kann.

## acceptance

- **Vollständige Entscheidungstabelle.** Für **jeden** `ui-*`-Knoten ist
  festgehalten: dient seine Farbe `variant` oder `color` (oder ist Farbe N/A) —
  **mit Begründung**, die benennt, *was das Backend-Element tatsächlich unterstützt*
  (Shoelace heute) und ob die Vokabel **Nicht-Farb-Ausprägungen** enthält (dann
  `variant`, ADR 0039 §2). Tabelle lebt in `docs/nodes/concepts/field-conventions.md`
  (von `theming.md` verlinkt).
- **Jede Abweichung ist benannt.** Knoten, deren heutige Zuordnung der Tabelle
  **widerspricht**, sind als Findings gelistet (Knoten + Feld + warum falsch).
  Eine Umklassifizierung ist ein **Breaking Field Change** → wird **nicht** hier
  umgesetzt, sondern je Knoten als **Folge-Paket mit Migration** angelegt
  (ADR 0039, Consequences: dieser ADR genehmigt keinen konkreten Move vorab).
- **Kein Knoten trägt beides wirksam.** Belegt, dass `variant` und `color` nirgends
  gleichzeitig aktiv sind (Exklusivität ADR 0015 §1) — bzw. die Verstöße sind als
  Findings gelistet.
- **Backend-Neutralität dokumentiert.** Die Tabelle hält je Knoten fest, was ein
  **zweites Backend** mindestens können muss, um die gewählte Seite zu bedienen —
  in der Form, die **P102** später als Spalte übernehmen kann.
- **Owner-Review.** Die Tabelle + die Findings gehen an den Owner, **bevor**
  Folge-Pakete angelegt werden — die Zuordnung ist eine Produkt-Entscheidung,
  keine Ableitung.

## verify

`unit` — dies ist ein **Analyse-/Dokumentations-Paket**: kein Verhaltens-Change,
also nichts im Browser zu messen. Belege sind Schema/Editor/Renderer-Fundstellen
(Datei:Zeile) je Knoten; `check:links`/`check:specs`/`check:roadmap` +
`pnpm validate` grün. Etwaige Verhaltens-Änderungen entstehen erst in den
Folge-Paketen (dann `browser`).

## spec

`docs/nodes/concepts/field-conventions.md` — die variant-vs-color-Entscheidungs-
tabelle + die Regel aus ADR 0039 §2/§3. Verlinkt aus
`docs/nodes/concepts/theming.md`.

## tests

Kein Test-Change (Analyse-Paket). Die `tests`-Referenz zeigt auf den Katalog des
Auslöser-Knotens; Folge-Pakete tragen ihre eigenen Kataloge.

## notes for the implementer

- **Rollenteilung beachten:** das ist ein **Audit** — Findings + Tabelle, **keine**
  Umklassifizierung. Wer hier einen Knoten „nebenbei" umstellt, verletzt den
  Owner-Review-Schritt.
- **Quellen:** `packages/schema/src/contracts.ts` (die `*_VARIANTS`-Vokabeln),
  `packages/schema/src/node-definitions.ts` (wer trägt `variant`/`color`),
  `resources/lib/editor-common.js` (`resolveBaseFieldApplicability`, `variant:true`
  → color N/A), die Shoelace-Adapter im Renderer (was das Element real unterstützt).
- **Matrix-Generator** `pnpm gen:field-matrix` (`scripts/gen-field-matrix.js`)
  liefert die Feld-Übersicht als Startpunkt — die Backend-Spalte ist Handarbeit.
- **Erwartete Kandidaten** (Startpunkte, **keine** bestätigten Findings):
  Knoten mit gemischter Vokabel (ui-button: `ghost`/`link` neben Farben; ui-tabs:
  rein nicht-farbig → ist „variant" dort überhaupt Farbe, und fehlt dem Knoten
  dann ein `color`?).
