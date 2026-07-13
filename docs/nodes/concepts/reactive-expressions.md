# Reactive-Expressions (`reactive`-Binding)

> Entschieden in [ADR 0010](../../adr/0010-reactive-binding-client-expressions.md).
> Implementierung: P115 (Schema + Renderer) und P116 (Editor). Bis beide `done`
> sind, beschreibt diese Seite den **Zielzustand**.

Das `reactive`-Binding macht einen anzeigbaren Wert zu einer **abgeleiteten
Sicht auf den Client-Zustand**: eine einzelne JavaScript-Expression, die
Route-Parameter, Store-Werte und Query-Ergebnisse liest und den anzuzeigenden
Wert zurückgibt. Sie wird vom Renderer bei **jedem** Snapshot neu ausgewertet —
ändert sich die Route, ein Store oder ein Query-Ergebnis, ändert sich die
Anzeige. Ohne Backend-Knoten, ohne Events, ohne `clientId`.

**Das Motivbeispiel:** Eine Route `/customers/:id`, deren Parameter Teil eines
Textes sein soll. Statt `onEnter → function → ui-store → store-Binding` reicht
auf dem `ui-text` ein `reactive`-Binding mit:

```js
`Kunde ${routeParam.id}`
```

Korrekt bei Deep-Link, Refresh und Navigation; pro Client automatisch richtig.

## Serialisierung

```json
{ "kind": "reactive", "value": "`Kunde ${routeParam.id}`" }
```

`value` trägt den **Quelltext der Expression** (kein Pfad, keine Referenz).

## Die Expression

- **Genau eine synchrone JavaScript-Expression** (ES2020). Kein
  Funktionskörper: keine Statements, keine Zuweisungen, kein `async`/`await`,
  keine Semikolon-Ketten. Formal: der Quelltext muss als
  `return ( <quelltext> );` parsebar sein.
- **Template-Literals sind das erwartete Idiom** und dürfen mehrzeilig sein.
- Ausführung in **Strict Mode**. Der Rückgabewert wird über die normalen
  Wert-Rendering-Regeln angezeigt (Strings direkt; number/boolean als String;
  nicht darstellbare Objekte gemäß der Invalid-Value-Konvention, siehe
  [value-rendering.md](value-rendering.md)).
- **Nur lesen.** Es gibt keine Schreib-API. Das Ergebnis einer Reactive-
  Expression ist kein Zustand, sondern eine Sicht auf Zustand — wer Zustand
  schreiben will, nutzt Stores ([stores.md](stores.md)).

## Die Globals

Die Expression sieht exakt die Quellen, die der Renderer auch für die
deklarativen Binding-Arten auflöst — nicht mehr:

| Global | Typ | Bedeutung | Beispiel |
|---|---|---|---|
| `routeParam` | Objekt | Aufgelöste Parameter der **aktuell aktiven Route** (gleiche Quelle wie das `routeParam`-Binding). Fehlender Parameter → `undefined`. | `routeParam.id` |
| `store(name)` | Funktion | Live-Wert des `ui-store` der Parent-App, dessen **Name** (`name`-Feld, getrimmt, exakter Vergleich) übergeben wird. Aufgelöst wird Name → `statePath` → Live-Wert im Client-State. | `store("customer").name` |
| `query(pfad)` | Funktion | Wert am Pfad innerhalb der Query-Ergebnisse (gleiches Lookup wie das `query`-Binding). | `query("customers.total")` |

### Scope-lokale Globals — `item` / `index` / `prop` (P185)

> Entschieden in [ADR 0017](../../adr/0017-ui-repeat-template-container-render-time-scope.md)
> (item/index) und [ADR 0020](../../adr/0020-component-model-dedicated-ui-component-node.md)
> (prop); Reactive-Anbindung in P185 (baut auf P164/P178 auf).

Steht der bearbeitete Knoten **innerhalb** eines `ui-repeat` bzw. einer
`ui-component`-Definition, sieht die Expression zusätzlich die **scope-lokalen**
Globals der jeweils **innersten** aktiven Instanz. Sie sind **pro Instanz**: der
Renderer injiziert beim Klonen je Zeile die instanz-eigenen Werte in den
Auswertungs-Kontext — dieselbe Expression liefert je Zeile ihr eigenes Ergebnis.

| Global | Typ | Bedeutung | Beispiel |
|---|---|---|---|
| `item` | Wert | Das **ganze aktuelle Element** der innersten Repeat-Iteration; `item.<feld>` liest ein Feld. **Außerhalb** eines Repeats → `undefined`. | `` `Zeile: ${item.name}` `` |
| `index` | Zahl | Die **nullbasierte Position** des aktuellen Elements in der innersten Repeat-Iteration. **Außerhalb** eines Repeats → `undefined`. | `` `Zeile ${index}` `` |
| `prop` | Objekt | Die aufgelösten **Props** der innersten `ui-component`-Instanz; `prop.<name>` liest eine Prop. **Außerhalb** einer Component-Definition → `undefined`. | `` `${prop.label}` `` |

Wie bei den scope-lokalen Binding-Arten (`item`/`index`/`prop`) ist der Zugriff
**außerhalb** des passenden Containers kein Fehler, sondern `undefined` — die
Expression bricht nicht, sie liefert nur keinen Wert. Die Editor-Completion und
das Doku-Panel bieten `item`/`index`/`prop` **nur im passenden Scope** an
(Gating-Logik wie bei den Binding-Arten, P182).

**Bewusst nicht verfügbar:**

- `msg` — zur Render-Zeit existiert kein Message-Kontext. Message-getriebene
  Werte sind die Domäne der Binding-Arten `msg` und `JSONata` (P113).
- `flow` / `global` / `env` — serverseitige, nicht-reaktive Quellen.
- DOM, `window`, Netzwerk o. Ä. — die Expression ist eine reine Ableitung.

**Stores per Name — der bewusste Trade-off.** Das `store`-*Binding* (P67)
referenziert per Knoten-ID (umbenennungsrobust). In einer Expression wäre eine
ID unleserlich und Completion sinnlos; deshalb gilt hier der **Name** als
Schnittstelle. Konsequenzen:

1. Store-Namen, die in Expressions verwendet werden, müssen **innerhalb ihrer
   App eindeutig** sein.
2. Das Umbenennen eines Stores bricht Expressions, die ihn referenzieren — die
   **Deploy-Validierung im Editor** meldet unbekannte/mehrdeutige Namen als
   Fehler (Knoten ungültig), bevor das in der App sichtbar wird.

## Reaktivität — warum es „einfach funktioniert"

Es gibt **kein Dependency-Tracking**. Der Renderer wertet jedes Binding bei
jedem Snapshot neu aus; eine Reactive-Expression wird dabei einfach mit
ausgewertet. Snapshot-Anlässe sind Routenwechsel, Store-/State-Änderungen und
Query-Updates — also genau die Quellen der Globals. Damit ist die Anzeige

- korrekt beim **Deep-Link** und **Refresh** (die Route ist beim ersten Render
  bekannt),
- korrekt bei **Navigation** (neuer Snapshot mit neuen `routeParam`s),
- korrekt pro **Client** (jeder Client hat eigenen Route-/State-Kontext) —
  kein `clientId`-Routing nötig.

Zur Performance wird der Quelltext **einmal kompiliert und gecacht** (Schlüssel:
der Quelltext selbst); pro Render läuft nur die Auswertung.

## Fehlerverhalten

Eine Expression darf das Rendering **niemals** brechen:

- Wirft die Auswertung (Syntax war ok, aber z. B. `store("gibtsnicht")` oder
  `routeParam.id.foo.bar`), rendert das Feld gemäß der
  Invalid-Value-Konvention (P104) — kein Crash, kein leerer Snapshot.
- Der Fehler wird **einmal pro distinktem Fehler** über die bestehende
  Client-Logging-/Error-Forwarding-Pipeline gemeldet (nicht bei jedem
  Re-Render erneut), damit die Ursache in `ui-log`/Debug sichtbar ist, ohne zu
  fluten.

## `onMissing` — pro Feld wählbares Verhalten bei fehlendem Wert (P219, ADR 0034)

Jedes bindbare Wert-Feld trägt ein **optionales** `onMissing`-Verhalten, das
bestimmt, was passiert, wenn dieser Binding-Wert **nicht auflösbar** ist — eine
`reactive`-Expression scheitert oder ein `store`-Sub-Pfad trifft auf einen Skalar
bzw. wird nicht gefunden:

| Wert | Wirkung | Report |
|---|---|---|
| `marker` (**Default**, fehlt → dies) | rendert den Invalid-Value-Marker `"?"` (P104) | einmaliger Report wie bisher |
| `ignore` | rendert **leer** (`""`) | **kein** Report |

- **Default unverändert:** ohne gesetztes `onMissing` verhält sich jedes Feld
  exakt wie zuvor (`marker`/`"?"`, inkl. der bestehenden Reports) — rein additiv,
  bestehende Flows ändern ihr Verhalten nicht.
- `ignore` liefert dasselbe „leer statt `?`", das [ADR 0032](../../adr/0032-store-subpath-missing-key-is-transient-not-an-error.md)
  dem transienten Objekt-Slice-Fall gibt — jetzt **pro Feld** wählbar.
- Im Editor steht der Selektor als schlichtes `<select>` in der Feld-Zeile neben
  dem Binding (Default `marker`).
- Dies ist das Foundation-Paket (nur `marker`/`ignore`); die reicheren Verhalten
  (`errorPort`, `throw`/Catch, Fallback-Slot) folgen in P220 (ADR 0034 §Decision).

## Editor-Erlebnis (P116)

Der typedInput-Typ **`Reactive`** (Position 4 im kanonischen Typsatz, siehe
[editor.md](editor.md)) zeigt den Quelltext einzeilig; der Expand-Button öffnet
den **Expression-Editor-Dialog** (Vorbild: Node-REDs JSONata-Editor):

- **Code-Editor** über Node-REDs gebündelten Editor (`RED.editor.createEditor`,
  Monaco ab Node-RED 2.x; mit Ace-Fallback funktioniert der Dialog ohne
  Completion weiter).
- **Completion aus dem echten Graphen:** `store("` schlägt die tatsächlich
  existierenden Store-Namen der App vor; `routeParam.` die `:param`-Namen der
  Route, unter der der Knoten gemountet ist; dazu die drei Globals selbst. Im
  Repeat-/Component-Scope zusätzlich die scope-lokalen Globals `item`/`index`
  bzw. `prop` (nur wenn der Knoten innerhalb des passenden Containers liegt).
- **Validierung zweistufig:** beim Tippen Syntaxprüfung (Expression-Parse,
  Fehlermeldung inline unter dem Editor); beim Speichern/Deploy zusätzlich
  Referenzprüfung (unbekannter/mehrdeutiger Store-Name → Knoten ungültig,
  Deploy blockiert).
- **Doku-Panel im Dialog:** die Globals-Tabelle dieser Seite in Kompaktform
  plus Beispiele; Quelle ist **diese Datei**, damit Editor-Hilfe und Doku nicht
  divergieren (Link-Muster wie bei den Inline-Hilfen der Knoten).

## Beispiele

```js
// Route-Parameter als Teil eines Textes (das Motivbeispiel)
`Kunde ${routeParam.id}`

// Kombination aus Store und Route-Parameter
`${store("customer").name} (#${routeParam.id})`

// Bedingte Anzeige aus einem Query-Ergebnis
query("customers.total") > 0
    ? `${query("customers.total")} Kunden`
    : "Keine Kunden"

// Scope-lokal in einem ui-repeat: jede Zeile bekommt ihren eigenen Wert
`Zeile ${index}: ${item.name}`
```

## Abgrenzung — wann NICHT `reactive`

| Bedarf | Richtiges Mittel |
|---|---|
| Roher Einzelwert aus der URL | `routeParam`-Binding (einfacher, kein Code) |
| Wert, der auf eine eingehende `msg` reagieren soll | `msg`- oder `JSONata`-Binding (message-getrieben, P113) |
| Daten, die der Client nicht hat (DB, Berechtigungen) | Backend-Muster: `ui-route` `onEnter` → `function`/`ui-query` → `ui-store` (seit P112 bei jeder Ankunft zuverlässig) |
| Eine Ableitung, die **mehrere** Knoten lesen sollen | offen („Derived Store", siehe [ui-store.md](../state/ui-store.md) „Offene Punkte") — bis dahin: Backend-Muster |
| Zustand schreiben | niemals per Expression — Stores über Operationen ([stores.md](stores.md)) |

## Referenzen

- [ADR 0010](../../adr/0010-reactive-binding-client-expressions.md) — Entscheidung und Begründung
- [ADR 0034](../../adr/0034-per-field-missing-binding-behavior-selector.md) — pro Feld wählbares `onMissing`-Verhalten (P219: `marker`/`ignore`)
- [editor.md](editor.md) — typedInput-Typen und Editor-Helfer
- [stores.md](stores.md) — Stores, `store`-Binding, State-Modell
- [value-rendering.md](value-rendering.md) — Anzeige-Regeln und Invalid-Value-Konvention
- [`ui-route`](../structure/ui-route.md) — Route-Parameter und Lifecycle-Events
