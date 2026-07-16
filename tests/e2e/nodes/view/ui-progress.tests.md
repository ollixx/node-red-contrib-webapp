# Testkatalog: ui-progress

> Format gemäß `.ai/agents/node-testing.md`. Frisch angelegt mit dem
> Konformitäts-Pass **P234** (die alten P43-Präsenz-Tests wurden verworfen).
> Alle Assertions sind aus dem Serializer-Pfad
> (`resources/lib/webapp-serializer.js`, `component.kind === "progress"`)
> abgeleitet — beobachtbare Ausgabe, nicht bloße DOM-Präsenz.

Anforderungs-Doku: [docs/nodes/feedback/ui-progress.md](../../../../docs/nodes/feedback/ui-progress.md).

## `tests/e2e/nodes/view/ui-progress.spec.ts`

### displayType

- **bar (Default) → `<sl-progress-bar value="75">`** — Ziel: die Standard-Darstellung
  ist der horizontale Balken mit skaliertem Wert (max=100 → 75 %); kein Spinner.
- **spinner → `<sl-spinner>`** — Ziel: `displayType: spinner` rendert immer den
  indeterminaten Shoelace-Spinner; ein gesetzter `value` wird ignoriert; kein
  `<sl-progress-bar>`.
- **circular → `<sl-progress-ring value="40">`** — Ziel: `displayType: circular`
  rendert den kreisförmigen Ring mit skaliertem Wert.
- **circular ohne Wert → `<sl-spinner>`** — Ziel: der Ring hat keinen indeterminaten
  Modus; fehlt der Wert, ist die kreisförmige „Endlos"-Anzeige ein Spinner.

### value

- **Literal → `sl-progress-bar[value=75]`** — Ziel: literaler Wert setzt das
  `value`-Attribut (im Browser gemessen).
- **Store-Binding (live, SSE)** — Ziel: ein store-gebundener Wert wird gerendert
  (30 → 30 %) und aktualisiert sich nach `replace` auf 80 (80 %) per SSE.
- **fehlender Wert → indeterminate** — Ziel: kein Wert ⇒ `<sl-progress-bar
  indeterminate>` **ohne** `value`-Attribut (nicht Wert 0).

### label (P137)

- **Literal-Label** — Ziel: das Label erscheint als sichtbarer Slot-Text UND als
  a11y-`label`-Attribut des Balkens.
- **Store-gebundenes Label** — Ziel: der aufgelöste Live-Wert („Live") wird als
  Slot-Text gerendert (voller Binding-Satz, P137).

### showValue

- **true → Prozent-Text sichtbar** — Ziel: `75%` als Slot-Text.
- **false → kein Prozent-Text** — Ziel: kein `75%` im Balken.
- **bei indeterminate ignoriert** — Ziel: indeterminater Balken mit leerem Slot
  (kein Prozentwert).

### max-Skalierung (P234)

- **value=50, max=200 → 25 % gefüllt** — Ziel: der Balken skaliert `value/max`
  (`value="25"`).
- **showValue relativ zu max** — Ziel: der eingeblendete Prozentwert ist `25%`
  (relativ zu `max`, nicht der Rohwert 50).

### Basis-Feld `color` (P234)

- **gebundene Farbe → `--indicator-color`** — Ziel: der Serializer emittiert die
  Shoelace-Custom-Property `--indicator-color` im `style`.
- **`--indicator-color` am gerenderten Element (computed style)** — Ziel: die
  Füllfarbe ist real gesetzt (`getComputedStyle` gemessen: `rgb(0, 128, 0)`).

### Basis-Feld `visible` (Render-Gate, ADR 0037)

- **store=false → nicht gerendert** — Ziel: gebundenes `visible=false` verhindert
  das Rendern (weder `<sl-progress-bar>` noch `<sl-spinner>`).
- **store=true → gerendert** — Ziel: gebundenes `visible=true` rendert den Balken.

### msg.payload-Input

- **msg.payload aktualisiert den Wert live** — Ziel: eine Nachricht am Input-Port
  setzt `value` (10 → 42) und pusht per SSE (beweist `inputs: 1`).

### Ports

- **1 Input, 0 Output** — Ziel: `outputs: 0` (keine Output-Wires); der Input-Port
  ist durch den msg.payload-Test abgedeckt.
</content>
