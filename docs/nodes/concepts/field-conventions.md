# Feld-Konventionen (Namen + Carrier)

Diese Datei hält den **knotenübergreifenden** Feld-Modell-Vertrag fest: wie ein
Feld heißt und welches Carrier-Muster es verwendet. Sie ergänzt
[editor.md](editor.md) (Editor-Helfer) und [layout.md](layout.md)
(Platzierungs-Boilerplate) um die Regeln, die **über alle Knoten hinweg** gelten.

> Rationale: [ADR 0038](../../adr/0038-field-model-consistency-naming-and-carrier-normalization.md).
> Ein Cross-Node-Audit (Session 2026-07-14, 45 Knoten × 128 Felder, 127/128
> Felder verifiziert konsumiert) zeigte, dass die Felder inkonsistent benannt
> sind, ohne dass etwas die **knotenübergreifende Kohärenz** prüft:
> [`check:specs`](editor.md) erzwingt nur `defaults`↔Spec **pro Knoten**. Diese
> Konvention macht den Zielzustand explizit; der Tripwire `pnpm check:fields`
> (`scripts/check-fields.js`) erzwingt ihn.

> **Migrations-Reihenfolge.** Dieses Dokument beschreibt den **Zielzustand**. Der
> Baum entspricht ihm heute noch nicht vollständig: die Umbenennungen (`parent` →
> `app`, `*Id` → bloßer Name) folgen in **P228**, der Legacy-Sweep (`*Path`/`*Json`/
> totes `storeId`/`path`/Pagination-Aliase) in **P229**. Bis dahin trägt eine
> **kuratierte Allowlist** in `scripts/check-fields.js` die heutigen Verstöße mit je
> einer Ein-Zeilen-Begründung, damit `pnpm validate` grün bleibt; die Liste
> schrumpft mit P228/P229 auf leer.

---

## Namensregeln

### Referenz-Felder tragen den **bloßen** Konzeptnamen

Ein Feld, dessen Wert die **Id eines anderen Knotens** ist, heißt wie das
Konzept — **ohne** `Id`-Suffix; der Wert *ist* die Id, wie bei `store` und
`mount`:

| Zielzustand | statt (Legacy) | referenziert |
|---|---|---|
| `store`     | `storeId`      | einen `ui-store` |
| `layout`    | `layoutId`     | ein Layout-Preset |
| `route`     | `routeId`      | eine `ui-route` |
| `definition`| `definitionId` | eine `ui-component-definition` |

**Ausnahmen (kein Referenz-Feld, `Id`-Suffix bleibt):**

- `uiId` — die **eigene** stabile Instanz-Id eines Knotens, keine Referenz.
- `selectedId` — ein **ausgewählter Wert** (die Id des selektierten Datensatzes),
  keine Knoten-Referenz.

### `app` = besitzende App, `mount` = Render-Slot

- **`app`** benennt die **besitzende App-Id** (auf jedem Nicht-App-Knoten). Das
  frühere `parent` war irreführend benannt — es hielt nie einen Slot-Parent,
  sondern die App-Id. (Rename in P228; bis dahin heißt das Feld noch `parent`.)
- **`mount`** ist der **Render-Slot** (`<typ>:<id>/<slot>`), siehe
  [layout.md](layout.md). Ein Knoten deklariert entweder `mount` (Render-Knoten)
  oder trägt `app` (Logik-Knoten); Render-Knoten dürfen zusätzlich `app` für
  O(1)-Scoping tragen.

---

## Carrier-Regel: genau **ein** Binding-Muster

Ein bindbares Feld `<base>` besteht aus **zwei** Feldern und nur diesen:

- **`<base>`** — das Binding-**Objekt** (der aufgelöste Wert / die Literale).
- **`<base>Binding`** — der **Editor-typedInput-Carrier**, der das Binding über
  `oneditsave` treibt (siehe [editor.md](editor.md), ADR 0012).

Der frühere `<base>Path`-Zwilling ist **entfernt** — der Binding-Pfad (ADR 0012)
ist kanonisch. Es darf **kein** `<base>Path`-Default mehr geben, wenn
`<base>Binding` existiert. Ebenso entfernt sind die rohen JSON-Authoring-Carrier
`<base>Json` (`optionsJson`, `itemsJson`).

---

## Das Basis-Feld `color`: Tokens + jede Farbe + Binding (P238, ADR 0039)

`color` ist ein **Basis-Feld** ([ADR 0015](../../adr/0015-common-base-fields-and-editor-structure.md))
und folgt der Carrier-Regel oben: `color` (Binding-Objekt) + `colorBinding`
(typedInput-Carrier). Es hat darüber hinaus eine **feste Ausprägung** — ein
**Standard-Control** aus dem gemeinsamen Helper `installBaseFields`
(`resources/lib/editor-common.js`), das auf **allen** Knoten mit `color` identisch
ist ([ADR 0039](../../adr/0039-colour-field-model-color-is-tokens-plus-any-colour-variant-is-the-reduction.md) §1):

| Weg | typedInput-Typ | persistiert als |
|---|---|---|
| **Theme-Token** | `token` (SelectBox über `COLOR_TOKENS`) | `{kind:"literal", value:"token:<name>"}` |
| **Farbe** | `str` (Textfeld + Color-Selector auf dem Expand-Button) | `{kind:"literal", value:"<css>"}` |
| **Binding** | der volle kanonische Satz (ADR 0012) | das jeweilige Binding-Objekt |

**Konventionen, die daraus folgen:**

- **`color` ist überall bindbar, wo es gilt.** Ein Knoten darf das Basis-Feld
  **nicht** auf einen Plain-String herunterstufen — genau das hatte `ui-icon` bis
  P238 getan (`color: z.string()`-Override + `omit:["color"]`), womit die Farbe
  dort gar nicht bindbar war. Solche Overrides sind unzulässig.
- **`variant` und `color` schließen einander aus.** `variant` ist die Reduktion
  auf die Tokens, `color` die Obermenge (Tokens **und** jede Farbe). Welcher der
  beiden ein Knoten führt, ist **Backend-getrieben** und wird node-lokal begründet
  (ADR 0039 §3). Vokabular + Auflösung: [theming.md](theming.md).
- **Ein Token wird nie roh ausgegeben.** Das `token:`-Präfix hält Token und Farbe
  eindeutig auseinander; aufgelöst wird zentral in `resolveColorValue`
  (`resources/lib/webapp-serializer.js`), nie im einzelnen Knoten.
- **Plain-String-Back-Compat.** Ein deployter Plain-String-`color` wird verlustfrei
  als `literal`-Binding übernommen — im Editor beim Öffnen und zur Laufzeit in
  `mapConfig` (`normalizeColorField`), damit auch ein nie wieder geöffneter Flow
  unverändert rendert.

---

## Der Tripwire `pnpm check:fields`

`scripts/check-fields.js` ist **read-only** (schreibt nichts) und in
`pnpm validate` eingehängt. Er parst die `defaults`-Blöcke aller `ui-*`-Knoten-
`.html` (kommentar-robust, wie `check:specs` / `check:roundtrip`) und prüft
knotenübergreifend drei Regeln — jeder Verstoß nennt **Knoten + Feld**:

- **(a) Carrier-Zwilling-Konsistenz.** Hat ein Knoten `<base>Binding`, darf **kein**
  `<base>Path`-Default existieren.
- **(b) Kein wiedereingeführtes Legacy-Feld.** Keine `*Json`-Carrier; kein totes
  `storeId` und dessen `path`-Partner (das ADR-0027-Input-Paar — `path` **allein**
  auf `ui-store-read`/`-action` ist der lebende Store-Subpfad und `ui-route.path`
  der URL-Pfad, beide bleiben); keine Pagination-Aliase `page`/`currentPagePath`.
- **(c) Bare-Name-Referenzen.** Referenz-Felder folgen der Bare-Name-Regel; jedes
  `*Id`-Feld ist ein Verstoß außer der Keep-Liste (`uiId`, `selectedId`).

**Allowlist-Semantik.** Jeder Eintrag `{ <knoten>: { <feld>: "Begründung" } }`
**schwächt** die Prüfung für genau dieses `(Knoten, Feld)`-Paar (unterdrückt alle
Regeln dafür). Die Liste ist kuratiert und schrumpfend: sie trägt nur die heute
existierenden ADR-0038-Verstöße (Ziel: P228/P229 → leer). Ein **neuer** Eintrag
ist ausschließlich durch einen ADR-Grund gerechtfertigt, nie durch „noch nicht
migriert".

Der Vertrag ist Regel-für-Regel durch `scripts/check-fields.test.ts` bewiesen
(konform → grün, je Regel ein Verstoß → rot, allowlisted → grün).

## Der Tripwire `pnpm check:binding-docs`

Ein **bindbares Feld wird in seiner Spec als bindbar dokumentiert** — nie als
statisches „Textfeld" bzw. mit „kein Binding" / „nicht bindbar" (ADR 0012,
Binding-Ubiquität). `scripts/check-binding-docs.js` (P237) ist **read-only** und
in `pnpm validate` + `pnpm test:specs` eingehängt. Er liest die **Schema-Wahrheit**
(`packages/schema/src/node-definitions.ts`): ist ein Feld binding-fähig (Union mit
`bindingSchema` bzw. direktes `bindingSchema`; das `writeToBindingSchema` der
Schreib-Hälfte zählt bewusst **nicht**) und hat es eine Zeile in der
kanonischen „Felder"-Tabelle der Spec, deren „Editor-Typ"-Spalte „Textfeld" sagt
(oder deren Text „kein Binding"/„nicht bindbar" behauptet), meldet er
**Knoten + Feld**. Felder ohne eigene Feldzeile (die zentral dokumentierten
Basis-Felder `visible`/`disabled`/`color`) werden nicht geprüft.

**Allowlist-Semantik.** Wie bei `check:fields`: jeder Eintrag schwächt genau ein
`(Knoten, Feld)`-Paar und braucht eine ADR-Begründung; die Liste ist schrumpfend.
P237 fixte seine vier Ziel-Felder (nie allowlisted); die vom Guardrail zusätzlich
entdeckte Muster-4-Drift anderer Knoten ist an deren eigene Konformitäts-Pässe
delegiert (kein Doppelfix). Der Vertrag ist durch `scripts/check-binding-docs.test.ts`
bewiesen.

---

## Audit-Referenz

Die vollständige Befundliste (was „konsistent" bedeutet und warum) steht in
[ADR 0038](../../adr/0038-field-model-consistency-naming-and-carrier-normalization.md)
(§Context, fünf verifizierte Befunde). Die zugrunde liegende Matrix (45 Knoten ×
128 Felder) ist die Audit-Quelle der Session 2026-07-14; ADR 0038 ist ihr
kanonischer Auszug.

---

## Feld-Matrix (generiert)

Eine knotenübergreifende Übersicht aller ui-Knoten × ihrer Felder — mit den
Konsistenz-Findings (geplante Umbenennungen P228 / Legacy-Entfernungen P229) als
Overlay — wird generiert nach [`field-matrix.html`](../field-matrix.html):

```bash
pnpm gen:field-matrix
```

Die Findings werden aus denselben Regeln wie `pnpm check:fields` auf den
Live-`defaults` abgeleitet, räumen sich also mit P228/P229 selbst auf. Die HTML-Datei
ist **generiert** — nicht von Hand bearbeiten, sondern neu generieren.

## Siehe auch

- [editor.md](editor.md) — Editor-Helfer, Node-Picker, Binding-typedInputs
- [layout.md](layout.md) — Platzierungs-Boilerplate (`mount`, `order`, `row`/`col` …)
- [stores.md](stores.md) — Semantik des `store`-Bindings
- [ADR 0038](../../adr/0038-field-model-consistency-naming-and-carrier-normalization.md) — der Feld-Modell-Vertrag
- [ADR 0012](../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md) — Binding-Carrier (`<base>` + `<base>Binding`)
- [ADR 0027](../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md) — `writeTo` löst das Input-`storeId`/`path`-Paar ab
