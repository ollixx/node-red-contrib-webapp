# Daten anzeigen

Server-Daten auf der Seite: Queries und ihr Fetch-Loop, Tabellen, Listen,
wiederholte Templates und Pagination.

> English (canonical): [../../guides/displaying-data.md](../../guides/displaying-data.md)

## Ziel

Server-Daten über eine `ui-query` in eine gebundene `ui-table` laden, mit
`ui-repeat` ein Template pro Element wiederholen und das Paging-Muster
kennen.

## Voraussetzungen

- [Bindings & State](bindings-state.md) — besonders die
  Store-vs.-Query-Regel.

## Queries: geladene Daten mit Lebenszyklus

Eine `ui-query` deklariert, *wo* geladene Daten liegen (ihr **Query
Path**, z. B. `fruits.list`), und verfolgt ihren Ladezustand — sie lädt
**nichts** selbst. Die Datenquelle ist das, was du dahinter verdrahtest
(ein Datenbank-Knoten, ein HTTP-Request, eine `function`). Das ist
Absicht: eine frisch deployte Query ist leer, bis der Loop unten läuft —
„anfangs leer" ist normal, kein Fehler.

**Der Query-Loop (Refresh → Fetch → Daten zurück):**

1. Ein **Trigger** erreicht den Input-Port der Query — typisch das
   `onEnter` einer Route, ein Button-Klick oder ein Refresh einer
   `ui-query-action`.
2. Die Query reicht den Trigger an ihrem **Output-Port** durch und setzt
   sich auf `loading`.
3. Hinter dem Output sitzt deine **Datenquelle**. Sie lädt die Zeilen und
   schickt sie **zurück an den Input der Query** als
   `msg.ui.query = { queryPath: "<pfad>", data: <zeilen> }` (bzw.
   `error: "<meldung>"` im Fehlerfall).
4. Die Query legt die Daten ab, und jedes `query:<pfad>`-Binding
   aktualisiert sich live. Die Daten-Rückgabe ist terminal — sie wird
   nicht erneut emittiert (kein Loop).

```js
// der function-Knoten hinter dem Output der Query:
msg.ui = { query: { queryPath: "fruits.list", data: rows } };
return msg; // zurück an den Input der Query verdrahten
```

Eine Query im Binding lesen: `query:<pfad>` liefert die **Daten**;
`query:<pfad>.loading`, `.error`, `.status`, `.updatedAt`, `.totalCount`
liefern den Lebenszyklus — binde die Sichtbarkeit eines Spinners an
`.loading`, einen Fehlertext an `.error`.

## Tabellen und Listen

- **`ui-table`** — binde **Rows** an die Query (`query:fruits.list`) und
  deklariere die **Columns** (die Feldnamen eines Zeilen-Objekts). Die
  Tabelle emittiert `rowSelect`- / `rowAction`-Events mit der ganzen
  Zeile in den Params — der Standard-Haken für „öffne die Detailseite".
- **`ui-list`** — dieselbe Idee für listenförmige Darstellung; binde
  **Items** und mappe die Item-Felder auf Label/Beschreibung der Liste.

## Repeat: eigenes Template pro Element

Wo Tabellen-/Listen-Layouts nicht reichen, klont `ui-repeat` ein
beliebiges Template einmal pro Array-Element:

- Binde seine **Items** an eine beliebige Array-Quelle (Store oder
  Query).
- Setze das **Key Field** (eine stabile Id pro Element), damit
  Re-Renders die Element-Identität behalten.
- Mounte beliebige Komponenten in den Template-Slot des Repeats.
  Innerhalb des Templates erscheinen zwei zusätzliche Binding-Arten:
  **item** (ein Feld des aktuellen Elements, z. B. `name`) und **index**
  (die Position des Elements). Das ist das Item-Field-Mapping:
  `item.name`, `item.role`, … pro Klon.

Das Repeat selbst fügt kein Styling und kein Layout hinzu — für
kartenartige Items einen `ui-container` ins Template schachteln.

## Pagination-Muster

Bei langen Listen server-seitig blättern und die Query den Loop treiben
lassen:

1. Jede Query besitzt einen impliziten per-Client-**Params-Store**
   (Seite, Seitengröße, Suche, …), adressierbar wie ein Store über den
   Query-Knoten.
2. Eine `ui-pagination` (oder ein beliebiger Button) schreibt `page` in
   diese Params — z. B. mit einer `ui-store-action` auf die Query.
3. Eine Params-Änderung feuert automatisch einen Refresh am Output-Port
   der Query, mit den aktuellen Params im Gepäck
   (`msg.ui.query.params`).
4. Dein Fetch liest `msg.ui.query.params.page`, lädt diese Seite und
   liefert `data` plus `totalCount` zurück. Binde das Total der
   Pagination an `query:<pfad>.totalCount`.

## Schritte

1. Erstelle eine App mit einer `ui-query` (Query Path `fruits.list`).
2. Verdrahte einen „Load fruits"-`ui-button` in den Input der Query und
   einen `function`-Knoten hinter den Output der Query, der drei Zeilen
   an den Input der Query zurückgibt (der Code oben). In einer echten
   App ist diese Function dein DB-/HTTP-Zugriff.
3. Mounte eine `ui-table` mit den Spalten `name,color,stock` und binde
   ihre Rows an `query:fruits.list`. Deploy: die Tabelle ist leer; ein
   Klick auf **Load fruits** füllt sie.
4. Füge einen `ui-store` mit einem Personen-Array und ein daran
   gebundenes `ui-repeat` (Key Field `name`) hinzu. Mounte zwei
   `ui-text`-Knoten mit **item**-Bindings `name` und `role` ins
   Repeat-Template. Deploy: pro Array-Element rendert ein
   Name/Rolle-Paar.

## Beispiel-Flow

Das fertige Ergebnis der Schritte:
[`examples/guide/displaying-data.json`](../../../../examples/guide/displaying-data.json)

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. Die Datei `examples/guide/displaying-data.json` auswählen (oder ihr
   JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/dataApp/` öffnen — **Load
   fruits** klicken und zusehen, wie sich die Tabelle füllt; darunter
   das wiederholte Personen-Template.

## Wie weiter

- [Formulare](forms.md) — die angezeigten Daten bearbeiten.
- [Actions & Events](actions-events.md) — auf Zeilenauswahl reagieren.
