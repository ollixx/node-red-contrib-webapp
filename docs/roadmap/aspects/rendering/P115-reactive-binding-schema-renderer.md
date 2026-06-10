---
id: P115
title: "reactive-Binding: Schema-Kind + Renderer-Auswertung (kompilierte JS-Expression, Fehler-Containment, Re-Evaluation pro Snapshot)"
epic: aspects/rendering
status: in_progress
dependencies: []
---
# P115 — `reactive`-Binding: Schema + Renderer

> Rationale & Entscheidung: [ADR 0010](../../../adr/0010-reactive-binding-client-expressions.md).
> Durable Spec (Zielzustand, bereits geschrieben): `docs/nodes/concepts/reactive-expressions.md`.
> Editor-Seite (typedInput, Monaco-Dialog, Completion): **P116** — NICHT Teil dieses Pakets.

## findings (Nutzer-Wortlaut, 2026-06-10)

- "hier wäre ja eine reaktive Funktion cool, die am Page Parameter ‚hängt' und
  dann den gesamten Text in einen Store schreibt. Wäre das was für frontend
  oder backend"
- "geile Idee. Ein neuer Type ‚Reactive' vielleicht?"
- Geklärt im Gespräch (siehe ADR 0010): **nicht** in einen Store schreiben —
  das Ergebnis ist eine *Sicht* auf Zustand, kein Zustand. Stattdessen eine
  **read-only Expression direkt am Binding**, ausgewertet vom Renderer, damit
  die Reaktivität (Route-/State-/Query-Wechsel) geschenkt ist. Motivbeispiel:
  Route `/customers/:id`, ui-text zeigt `` `Kunde ${routeParam.id}` `` —
  korrekt bei Deep-Link, Refresh, Navigation, pro Client.

## Kontext für den umsetzenden Agenten (bitte zuerst lesen)

Dieses Paket führt eine **neue Binding-Art** durch alle Schichten unterhalb des
Editors: Schema-Vertrag → Runtime-Durchleitung → Renderer-Auswertung. Es gibt
keinerlei Editor-UI in diesem Paket; getestet wird über Fixtures/Unit-Tests und
eine E2E-Fixture-Flow (Binding-Objekt direkt im Flow-JSON, der Weg funktioniert
heute schon für alle anderen Kinds, weil Bindings als Objekte durchgereicht
werden).

Lies vor der Umsetzung:
1. `docs/nodes/concepts/reactive-expressions.md` — der vollständige Vertrag
   (Expression-Form, Globals, Fehlerverhalten, Abgrenzungen). Dieses Paket
   implementiert exakt diese Seite; bei Widerspruch gilt die Seite + ADR 0010.
2. `packages/renderer/src/renderer.ts`, Funktion `resolveBinding` (ca. Zeile
   205) — der Switch über `binding.kind` mit dem `BindingSources`-Kontext
   (`sources.state`, `sources.queries`, `sources.params`, `sources.storePaths`).
   Hier hängt sich der neue Case ein.
3. `packages/schema/src/contracts.ts` (ca. Zeile 42) — das `kind`-Enum des
   Binding-Schemas.

## Zielmodell — was genau zu bauen ist

### 1. Schema (`packages/schema`)

- Das `kind`-Enum um `"reactive"` erweitern.
- Für `kind: "reactive"` gilt: `value` ist ein **nicht-leerer String**
  (der Expression-Quelltext). Kein `path`. Die bestehende Binding-Shape-
  Validierung entsprechend ergänzen (analog dazu, wie `literal` `value` trägt
  und `state`/`query`/`store` `path` tragen).
- Fixtures: mindestens eine Fixture mit einem `reactive`-Binding ergänzen,
  damit nachgelagerte Pakete eine kanonische Vorlage haben.
- Invariante beachten: `packages/schema` importiert **nichts** aus anderen
  Repo-Paketen.

### 2. Runtime-Durchleitung (`packages/runtime`, `nodes/webapp.js`)

- Erwartung: Bindings werden als Objekte unverändert in das `AppModel`
  übernommen; vermutlich ist hier **keine** Code-Änderung nötig. Der Agent
  verifiziert das explizit (Compile-Pass akzeptiert `reactive`-Bindings, keine
  Whitelist/Normalisierung filtert das Kind heraus) und ergänzt nur dort, wo
  eine solche Stelle existiert. Befund im Result dokumentieren.

### 3. Renderer-Auswertung (`packages/renderer`)

Neuer Case in `resolveBinding`:

```ts
case "reactive": {
    resolvedValue = evaluateReactiveExpression(binding.value, sources);
    break;
}
```

Anforderungen an `evaluateReactiveExpression` (eigene, unit-testbare Funktion):

- **Kompilieren einmal, auswerten oft.** Den Quelltext mit
  `new Function("routeParam", "store", "query", "\"use strict\"; return ( " + source + " );")`
  kompilieren und in einem modulweiten Cache (Map, Schlüssel = Quelltext)
  halten. Pro Auswertung nur der Funktionsaufruf mit frischen Argumenten.
- **Globals exakt nach Spec:**
  - `routeParam` = `sources.params` (das Objekt der aufgelösten Routenparameter
    — dieselbe Quelle wie `case "routeParam"`).
  - `store(name)` = Funktion: `name` (String, getrimmt) → Store des Kontexts
    mit exakt diesem **Namen** → dessen `statePath` → `getValueAtPath(sources.state, statePath)`.
    Dafür braucht `BindingSources` eine **neue Map `storeNamePaths`**
    (Name → statePath), aufgebaut an derselben Stelle, an der heute
    `storePaths` (ID → statePath) aufgebaut wird. Unbekannter Name → die
    Funktion **wirft** einen Error mit sprechender Message
    (`Unknown store "<name>"`), der vom Fehler-Containment (s. u.) gefangen
    wird. Mehrdeutiger Name (zwei Stores derselben App mit gleichem Namen) →
    ebenfalls Error (`Ambiguous store name "<name>"`); beim Aufbau der Map
    Duplikate als solche markieren statt still zu überschreiben.
  - `query(pfad)` = Funktion: `getValueAtPath(sources.queries, pfad)` —
    identisches Lookup wie `case "query"`.
  - **Sonst nichts**: kein `msg`, kein `flow`/`global`/`env`, keine weiteren
    Parameter. (Vollständiges Sandboxing ist laut ADR 0010 Non-Goal — der
    Autor ist der Flow-Autor; aber es wird keine Schreib- oder Host-API
    angeboten.)
- **Fehler-Containment — die harte Regel:** Wirft Kompilieren ODER Auswerten,
  darf **niemals** der Snapshot/das Rendering brechen. Verhalten:
  - Rückgabewert ist dann der Invalid-Value-Marker gemäß der bestehenden
    Konvention (P104 — so wie heute nicht darstellbare Werte behandelt werden;
    die bestehende Stelle dafür im Renderer finden und dieselbe Mechanik
    nutzen, nicht eine zweite erfinden).
  - Der Fehler wird über die bestehende Logging-/Error-Forwarding-Pipeline
    gemeldet (die Mechanik aus P55/P56, die auch andere Render-Fehler trägt),
    und zwar **einmal pro distinktem Fehler** (Dedup z. B. über
    Quelltext+Message), nicht bei jedem Re-Render erneut.
- **Synchron:** Gibt die Expression ein Promise/Thenable zurück, gilt das als
  Fehler (Message `reactive expression must be synchronous`) — gleiche
  Containment-Behandlung.

### 4. Reaktivität — nichts extra bauen, aber beweisen

Es gibt **kein** Dependency-Tracking und keine Subscriptions. Die Reaktivität
folgt allein daraus, dass der Renderer bei jedem Snapshot alle Bindings neu
auflöst. Das Paket baut dafür nichts Neues — aber die Tests müssen **beweisen**,
dass ein `reactive`-Wert sich bei (a) Routenwechsel, (b) Store-Änderung und
(c) Query-Update tatsächlich mitändert (siehe acceptance).

## Explizit OUT of scope

- Jede Editor-UI (typedInput-Typ, Dialog, Completion, Deploy-Validierung) → P116.
- Aufnahme in den kanonischen Typsatz-Helfer → P113/P116.
- `examples/customers-crud/flow.json` anfassen (das Beispiel wird erst mit dem
  Editor-Paket migriert, wenn überhaupt).
- Ein „Derived Store" (mehrere Konsumenten einer Ableitung) — bewusst offen,
  siehe ADR 0010 / ui-store.md „Offene Punkte".

## acceptance (observierbar; unit + browser)

- **Schema (unit):** `{ kind: "reactive", value: "`Kunde ${routeParam.id}`" }`
  validiert; `{ kind: "reactive" }` ohne `value` und mit leerem `value` wird
  abgelehnt.
- **Renderer happy path (unit):** Bei `sources.params = { id: "42" }` löst ein
  ui-text-`value`-Binding `` `Kunde ${routeParam.id}` `` zu `"Kunde 42"` auf.
- **store()/query() (unit):** `store("customer")` liefert den Live-Wert am
  `statePath` des gleichnamigen Stores; `query("customers.total")` das
  Query-Lookup. Unbekannter Store-Name → Feld rendert den Invalid-Value-Marker,
  übriger Snapshot intakt, Fehler einmalig in der Log-Pipeline.
- **Fehler-Containment (unit):** Eine werfende Expression
  (`routeParam.x.y.z`), eine Syntax-fehlerhafte Expression und eine
  Promise-zurückgebende Expression brechen den Snapshot nicht; jeweils
  Invalid-Value-Marker + ein (1) Log-Eintrag trotz mehrfacher Re-Renders.
- **Reaktivität (unit):** Dieselbe Definition, drei Auswertungen mit
  geänderten `sources` (anderer `params.id`, geänderter State unterm
  Store-Pfad, geändertes Query-Ergebnis) → drei entsprechend unterschiedliche
  Ergebnisse, ohne dass irgendetwas „invalidiert" werden muss.
- **Cache (unit):** Zwei Auswertungen desselben Quelltexts kompilieren genau
  einmal (beobachtbar z. B. über einen Compile-Zähler/Spy im Modul).
- **Browser (E2E, Fixture-Flow):** Ein Test-Flow (Fixture unter
  `tests/e2e/fixtures/`, NICHT das customers-crud-Beispiel) mit einer Route
  `/customers/:id` und einem ui-text, dessen `value`-Binding
  `{ kind: "reactive", value: "`Kunde ${routeParam.id}`" }` ist:
  - Direktaufruf (Deep-Link) von `/customers/42` zeigt „Kunde 42".
  - Navigation zu `/customers/7` (ohne Reload) zeigt „Kunde 7".
  - Reload auf `/customers/7` zeigt weiterhin „Kunde 7".

verify: browser

## spec / tests

- spec: `docs/nodes/concepts/reactive-expressions.md` (Zielzustand bereits
  geschrieben — Implementierung muss exakt dieser Seite entsprechen; bewusste
  Abweichungen dort nachziehen und im Result begründen, nie stillschweigend).
- tests: Unit-Tests in `packages/schema/test/` und `packages/renderer/test/`
  (neue Datei z. B. `reactive-binding.test.ts`); E2E-Spec neu z. B.
  `tests/e2e/reactive-binding.spec.ts` mit eigener Fixture. Da dieses Paket
  keinen einzelnen ui-Knoten ändert, gibt es keinen per-Node-Testkatalog zu
  aktualisieren — der Katalog-Eintrag für den typedInput-Typ kommt mit P116.

## Risiken / Hinweise

- Die Invalid-Value-Konvention (P104) und die Error-Forwarding-Pipeline
  (P55/P56) existieren bereits — **wiederverwenden**, nicht parallel neu bauen.
  Wo genau sie im Renderer hängen, vor der Umsetzung lokalisieren.
- `storeNamePaths`: Namen trimmen; leere Namen (Default „Store N" zählt als
  Name) nicht besonders behandeln — sie sind gültige Namen. Duplikate pro App
  erkennen und als „ambiguous" markieren (nicht still last-wins).
- `new Function` läuft dort, wo der Renderer läuft. Sollte der Renderer in
  einer Umgebung ohne `new Function` laufen (CSP o. Ä.), ist das ein Blocker
  laut Schema-Regel 9 — dokumentieren und stoppen, nicht improvisieren.
  (Erwartung: Node-Prozess, kein Problem.)
