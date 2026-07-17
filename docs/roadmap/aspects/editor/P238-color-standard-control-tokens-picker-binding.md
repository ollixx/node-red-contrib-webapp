---
id: P238
node: ui-icon
title: "`color`-Standard-Control: Theme-Token + Color-Selector + Binding im Base-Field-Helper; ui-icon-Override entfernt"
epic: aspects/editor
status: pending
dependencies: []
verify: browser
spec: docs/nodes/display/ui-icon.md
tests: tests/e2e/nodes/view/ui-icon.tests.md
---
# P238 — `color`-Standard-Control (Token + Picker + Binding) + ui-icon angleichen

> Rationale: **[ADR 0039](../../../adr/0039-colour-field-model-color-is-tokens-plus-any-colour-variant-is-the-reduction.md)**
> §1 + §4. Verfeinert [ADR 0015](../../../adr/0015-common-base-fields-and-editor-structure.md)
> (Base-Fields; `color` generell, `variant` node-spezifisch, wechselseitig exklusiv)
> unter [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).

## findings

Der Owner (2026-07-17), ausgehend vom ui-icon-Konformitäts-Pass (P235):

> „da frage ich mich, warum color nur als string Feld existiert ohne binding oder
> andere Typed Inputs."

> „color sollte standardisiert sein und folgendes erlauben: Die Theme Tokens aus
> Variant (primary etc.), Und die Auswahl über den üblichen Color Selector (HBS,
> RGB WEB-Werte etc.)"

> „Feld ‚Variant' ist ja die Reduktion auf die üblichen Theme tokens. Color bietet
> dann die Tokens und darüber alle Farben."

**Gemessener Ist-Zustand (Audit 2026-07-17):**
- `baseFieldsSchema` = `color: bindingSchema.optional()` → `color` ist auf ~30
  Knoten **bereits bindbar**; `installBaseFields` rendert es als *generischen*
  Value-typedInput auf `#node-input-colorBinding` (`valueBindingTypes({category:"value"})`).
  **Fehlt:** Theme-Tokens und Color-Selector — der Autor tippt einen Roh-Literal
  (`#ff0000`, `red`) oder bindet.
- **ui-icon steigt aus:** `omit: ["color","size"]` + `variant: false` im
  `installBaseFields`-Aufruf **und** ein Schema-Override
  `color: z.string().optional()` (statt Base-`bindingSchema`; last-key-wins — der
  Schema-Kommentar nennt es wörtlich „*ui-icon's plain-string `color`*"). Editor =
  nacktes Textfeld (`placeholder="e.g. #ff0000 or red"`). Auf ui-icon ist die Farbe
  damit **gar nicht bindbar**.
- `variant: true` erzwingt bereits `color` → N/A (ADR 0015 §1, implementiert).
- **Nicht in Frage:** `size` bleibt statischer Token (Schema-Kommentar: „*not a
  value-binding*"). Wechselseitige Exklusivität variant↔color bleibt.

## acceptance

- **Ein Control, drei Autoren-Wege.** Der `color`-typedInput im gemeinsamen
  Base-Field-Helper bietet zusätzlich zu den heutigen kanonischen Binding-Arten:
  - **Theme-Token** — eigener typedInput-Typ mit der semantischen Vokabel
    (`primary`, `success`, `warning`, `danger`, `neutral`, …), persistiert als
    **präfixiertes Literal `token:<name>`** (Präzedenz: der `asset`-Typ auf
    `ui-image.src` → `literal` `asset:<id>`).
  - **Color-Selector** — Auswahl beliebiger Farbe (HSB/RGB/Web-Werte).
  - **Binding-Arten** — unverändert der volle kanonische Satz (ADR 0012).
- **Token-Rendering (beobachtbar).** Ein `token:primary`-Wert wird als
  **Design-Token-CSS-Custom-Property** ausgegeben (z. B. `color: var(--sl-color-primary-600)`),
  **niemals** roh als `color: primary` (kein gültiger CSS-Wert). Browser: ein
  ui-icon mit Token `primary` hat einen **computed** `color`, der dem Theme-Primary
  entspricht und **nicht** dem Default-Textfarbwert.
- **Freie Farbe (beobachtbar).** Ein über den Selector gewählter Wert (`#ff0000`)
  erscheint als gerenderte Farbe — computed `color` = `rgb(255, 0, 0)`.
- **ui-icon-Override entfernt.** Das Schema-Override `color: z.string()` und der
  `omit:["color"]`-Opt-out sind weg; ui-icon nutzt Base-`color: bindingSchema.optional()`
  + das Standard-Control. Browser: ein **state/store-gebundenes** `color` auf
  ui-icon färbt das Icon live (SSE-Re-Render, computed `color` gemessen) — heute
  unmöglich.
- **Back-Compat (kein Flow verliert seine Farbe).** Ein deployter Plain-String-
  `color` (z. B. `"#ff0000"`) wird beim Öffnen verlustfrei als **literal**-Binding
  migriert und rendert unverändert; beim Speichern wird kein Alt-Feld mehr erzeugt.
  Muster: P146/P149/P151.
- **Additiv auf den übrigen ~30 Knoten.** Bestehende literale und gebundene
  `color`-Werte rendern unverändert; die zwei neuen Wege kommen hinzu. **Keine**
  Umklassifizierung variant↔color auf anderen Knoten (das ist P240).
- **Spec + Inline-Hilfe** von ui-icon beschreiben `color` als Token/Farbe/bindbar
  (Detail-Bar: Typ, Werte, Default, Binding-Kinds, beobachtbare Render-Wirkung);
  die Base-Field-Konvention ist in `docs/nodes/concepts/field-conventions.md`
  bzw. `docs/nodes/concepts/theming.md` nachgezogen.
- **E2E grün** (Haupt-Checkout).

## verify

`browser` — Token-, Freifarbe- und Binding-Weg je **computed style** am echten
Icon gemessen (nicht per Klasse/Tag, siehe [[verify-rendering-by-measurement-not-tags]]);
Back-Compat mit einem deployten Plain-String-`color` geprüft; `pnpm validate` +
`check:specs`/`check:fields`/`check:help`/`check:roundtrip`/`check:links` grün.

## spec

- `docs/nodes/display/ui-icon.md` — `color` neu (Token/Farbe/Binding).
- `docs/nodes/concepts/field-conventions.md` + `docs/nodes/concepts/theming.md` —
  die `color`-Konvention (Token + Farbe + Binding) als Base-Field-Standard.

## tests

`tests/e2e/nodes/view/ui-icon.spec.ts` + `ui-icon.tests.md` (Token/Freifarbe/
Binding/Back-Compat, gemessen). Unit: die Token→CSS-Var-Auflösung im Renderer und
die Plain-String-Migration.

## notes for the implementer

- **Das Control ist geteilt** (`installBaseFields` in `resources/lib/editor-common.js`
  — die *einzige* kanonische Kopie, siehe CLAUDE.md). Die Erweiterung landet damit
  auf allen Knoten, die das Base-`color` rendern. Das ist gewollt und **additiv**
  (ADR 0039, Consequences) — aber **nichts** an der variant↔color-Zuordnung ändern.
- **Token-Vokabel:** die semantischen Farb-Tokens; `TEXT_COLOR_VARIANTS` /
  `SEVERITY_VARIANTS` in `packages/schema/src/contracts.ts` sind der Startpunkt.
  **Nicht** die Nicht-Farb-Ausprägungen (`ghost`/`link`/`line`/`pills`) — die
  gehören zu `variant`, nicht zu `color` (ADR 0039 §2).
- **`asset`-Präzedenz lesen** (`ui-image.html` + `installIconField`-Umfeld): ein
  eigener typedInput-Typ, der als präfixiertes Literal persistiert und zur Laufzeit
  aufgelöst wird — genau das Muster für `token:<name>`.
- ui-icon rendert `color` heute als inline `style="color:…"` (in P235 per computed
  style gemessen) — dort setzt die Token-Auflösung an.
