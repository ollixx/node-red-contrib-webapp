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

---

## Audit-Referenz

Die vollständige Befundliste (was „konsistent" bedeutet und warum) steht in
[ADR 0038](../../adr/0038-field-model-consistency-naming-and-carrier-normalization.md)
(§Context, fünf verifizierte Befunde). Die zugrunde liegende Matrix (45 Knoten ×
128 Felder) ist die Audit-Quelle der Session 2026-07-14; ADR 0038 ist ihr
kanonischer Auszug.

---

## Siehe auch

- [editor.md](editor.md) — Editor-Helfer, Node-Picker, Binding-typedInputs
- [layout.md](layout.md) — Platzierungs-Boilerplate (`mount`, `order`, `row`/`col` …)
- [stores.md](stores.md) — Semantik des `store`-Bindings
- [ADR 0038](../../adr/0038-field-model-consistency-naming-and-carrier-normalization.md) — der Feld-Modell-Vertrag
- [ADR 0012](../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md) — Binding-Carrier (`<base>` + `<base>Binding`)
- [ADR 0027](../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md) — `writeTo` löst das Input-`storeId`/`path`-Paar ab
