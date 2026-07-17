---
id: P240
title: "Review: variant-vs-color pro Knoten — ist die semantische Trennung sauber, und trägt sie ein zweites Backend?"
epic: aspects/node-conformance
status: done
dependencies: [P238]
verify: unit
spec: docs/nodes/concepts/field-conventions.md
tests: tests/e2e/nodes/view/ui-icon.tests.md
---
# P240 — Review: variant-vs-color pro Knoten (backend-getrieben)

> Rationale: **[ADR 0039](../../../../adr/0039-colour-field-model-color-is-tokens-plus-any-colour-variant-is-the-reduction.md)**
> §3. Setzt [ADR 0015](../../../../adr/0015-common-base-fields-and-editor-structure.md)
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

## Result

**Done 2026-07-17.** Evidenz geliefert, **kein Knoten umklassifiziert** (das ist
per Akzeptanz Owner-Entscheidung + Folge-Pakete). Tabelle + Findings-Register in
`docs/nodes/concepts/field-conventions.md` (+190), verlinkt aus `theming.md`.
`pnpm validate` + alle Tripwires grün (`check:links`: 125 md, 1307 Quelldateien).

### Der zentrale gemessene Befund

**`color` wird vom Serializer auf genau VIER Knoten überhaupt honoriert** —
ui-icon (inline `color:`), ui-progress (`--indicator-color`, ~:967), ui-list
(inline `color:`), ui-divider (`--color`, ~:1436). Kein zweiter Render-Pfad:
`renderer.ts` fasst Farbe nie an, `wrapRenderedComponentHtml` wendet sie nicht
an (vom Implementer verifiziert; orchestrator-seitig im Serializer gegengeprüft).
Daraus folgt F-3/F-7/F-9: **8 Knoten bieten ein wirkungsloses `color`** — genau
was ADR 0039 §3 verbietet.

### Entscheidungstabelle (Kurzfassung)

- **Soll `variant`** (nativer Shoelace-`variant`-Attr): ui-button (beide §2-Klauseln:
  nativ **und** `ghost`/`link` nicht-farbig), ui-badge, ui-alert/ui-toast.
- **`variant` = Appearance** (beantwortet die Farbfrage **nicht**): ui-container
  (`sl-card`/`div`/`span`), ui-input (`filled`/`outlined`), ui-tabs, ui-pagination,
  ui-stepper.
- **Soll `color`** (echter Freifarb-Hook): ui-divider, ui-progress, ui-list, ui-icon
  (alle vier konform **und** implementiert) + ui-avatar + sechs Knoten mit Hook,
  aber unimplementiert.
- **Soll N/A**: Form-Controls (Farbe = `--sl-input-*`-Theming), ui-image, ui-log,
  ui-skeleton, ui-repeat/ui-tab/ui-accordion-section (kein Chrome), ui-app (Farbe
  **ist** dort das Design-Token-Set), alle structure/state/behavior-Knoten.

### Für P102 (die zweite Spalte)

Vier Capability-Tokens, je Backend als ✓/✗ absorbierbar: `native-variant` /
`appearance-switch` / `color-hook` / `—`. **Die nützliche Asymmetrie:** `color-hook`
ist die schwächste Anforderung (jedes DOM-Backend hat sie) → **`color` ist die
backend-neutrale Seite, `variant` die, die eine Backend-Fähigkeit voraussetzt.**

### Findings (11, keins gefixt — je Folge-Paket mit Migration)

- **F-6 — ui-avatar: die einzige echte Exklusivitäts-Verletzung** — trägt
  `variant: SEVERITY_VARIANTS` **und** `color: true` (beide die Farbachse); beide
  heute wirkungslos (`variant` → ungestyltes `data-variant`, `color` → nichts).
- **F-2 — ui-text: stärkster Umklassifizierungs-Kandidat** — reine Farbvokabel,
  kein nativer Variant, freier `color:`-Hook → die Regel sagt `color`. Migration
  verlustfrei (`COLOR_TOKENS` deckt `TEXT_COLOR_VARIANTS` exakt).
- **F-3/F-7/F-9 — 8 Knoten mit inertem `color`** (container, table, menu,
  breadcrumb, stepper, empty-state, tabs, accordion); sechs implementierbar,
  tabs + accordion haben keinen Hook → N/A.
- **F-8 — tote Schema-Felder**: ui-tabs/ui-pagination/ui-stepper deklarieren
  `variant` **ohne** `defaults`-Eintrag, **ohne** Editor-Control, **ohne** Rendering.
- **F-5** — ui-input `filled`/`outlined` nie gerendert (`sl-input[filled]` existiert,
  wird nicht emittiert).
- **F-4** — der N/A-Hinweis auf 8 Form-Knoten („…kommen aus Validierung/**Variant**")
  ist **zweifach falsch**: `INPUT_VARIANTS` enthält keine Farbe, und 6 der 8 haben
  gar kein `variant`-Feld.
- **F-1** — ui-alert/ui-toast konform nur **von Hand** (Feld heißt `severity`,
  `BASE_FIELDS.variant:false` + manuell `color:false`) → Exklusivität ist Zufall,
  nicht erzwungen.
- **F-15** — ui-skeleton hat **gar keine** `BASE_FIELDS`/`installBaseFields`; der
  ADR-0015-Rollout hat ihn nie erreicht, obwohl sein Schema `...baseFieldsSchema`
  spreadet. (Owner hat daraufhin **P241** aufgesetzt.)
- **F-14** — `ui-stepper.variant` = `horizontal`/`vertical` ist eine **Orientierung**;
  ui-divider nennt dasselbe Konzept `orientation`.

### Exklusivität — gegen den Code belegt

Die Durchsetzung ist **handgepflegt, nicht abgeleitet**: `variant: true` steht auf
**genau drei** Knoten (ui-button, ui-badge, ui-text). Vier Knoten
(container/tabs/pagination/stepper) tragen ein `variant`-Feld **und** `color` —
Verstoß gegen den Buchstaben von §1, nicht gegen seinen Geist.

### Offene Owner-Fragen (Produkt-Entscheidungen — bewusst nicht entschieden)

1. **Meint „exklusiv" die Felder oder die Farbachse?** §3 auf „nie zwei *Farb*-Achsen"
   schärfen → die vier sind konform, nur ui-avatar verletzt. Wörtlich lesen → vier
   Umbenennungen (`variant` → `displayType`/`orientation`; P49 hat das schon einmal getan).
2. **ui-text: `variant` → `color`?** Regel sagt ja, Migration verlustfrei. Dagegen:
   Konsistenz mit button/badge — und die heutige **klassenbasierte** Farbe folgt
   einem Theme-Wechsel, eine Freifarbe nicht.
3. **ui-avatar: welche Seite gewinnt?** Regel sagt `color`. Aber der P94-Schema-
   Kommentar wählte `variant` **bewusst für ein zweites Backend** („Bootstrap
   supports this natively via CSS classes") — die eine Stelle im Baum, wo P102s
   Argument schon heute beißt.
4. **Ist ein inertes `color` Bug oder Platzhalter?** Acht Knoten: implementieren
   (sechs können) oder N/A setzen (zwei können nicht) — beides Folge-Pakete.

### Nebenbefund (nicht angefasst, außerhalb des Scopes)

`theming.md` hat Vor-Drift: referenziert ein nicht existentes `TEXT_VARIANTS`,
listet ui-texts alte Prä-P111-Vokabel, lässt `span` in `CONTAINER_VARIANTS` aus und
behauptet `info` sei „kein Alias von primary", während der Serializer `info → primary`
mappt. Verdient ein eigenes Paket.
