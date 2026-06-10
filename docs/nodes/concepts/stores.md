# Stores und das `store`-Binding

Diese Datei beschreibt das zentrale Zustandskonzept der Webapp: den **Store**
(`ui-store`) und die **`store`-Binding-Art**, mit der andere Knoten den
aktuellen Wert eines Stores lesen.

Sie ergänzt die Knoten-Referenz [`ui-store`](../state/ui-store.md) um die
konzeptionelle Sicht und die Querverbindungen zu Bindings, Messages und
Multi-User-Routing.

## Was ist ein Store?

Ein `ui-store`-Knoten deklariert einen **benannten Zustands-Slice** im
Client-State der App. Der gesamte UI-Zustand einer App ist ein einziger
Objektbaum; jeder Store besitzt darin einen Pfad (`statePath`), unter dem sein
Slice liegt. Komponenten lesen Werte aus diesem Baum über Bindings; geschrieben
wird ausschließlich über Store-Operationen (nie direkt durch Komponenten).

Abgrenzung zu den verwandten Konzepten:

- **`ui-store`** — hält und verändert fachlichen/eingabebezogenen Datenzustand. Der **einzige** deklarative Pfad für Zustandsänderungen.
- **`ui-query`** — beschreibt geladene Datenquellen und ihren Ladezustand (siehe [`ui-query`](../state/ui-query.md)).
- **`ui-action`** — beschreibt UI-*Verhalten* (Navigation, Sichtbarkeit, Fokus …), **keine** Datenupdates (siehe [actions.md](actions.md)).

Fachliche Logik (CRUD, Validierung, Berechnung) gehört in den verdrahteten
Node-RED-Flow — der Store ist nur der Zustandsspeicher, nicht der Ort der Logik.

## Felder eines `ui-store`

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `parent` | ja | Die `ui-app`. Sie ist der Routing-Kontext: sie bestimmt, an welche Clients Notifications gehen und welche eingehenden Messages für diesen Store bestimmt sind. |
| `statePath` | ja | Der Pfad des Slice im Client-State. Innerhalb einer App eindeutig. Der Editor erzwingt einen einzelnen Bezeichner (nur `[A-Za-z0-9_]`, keine Punkte/Slashes) als Slice-Namen, z. B. `customers`, `draft`, `session`. |
| `initialValue` | optional | Startwert des Slice. Wird beim Aufbau des Client-State unter `statePath` gesetzt und ist das Ziel der `reset`-Operation. |
| `persist` | optional | Flag, ob der Slice clientseitig persistiert werden soll. **Hinweis:** Das Flag wird heute durch das Modell getragen, die clientseitige `localStorage`-Persistenz/Resynchronisierung ist aber noch nicht aktiv — siehe [multi-user.md](multi-user.md). Default `false`. |

Ein Store kann beliebig verschachtelte Werte halten. Für mehrere
zusammengehörige Felder braucht es **keinen** zweiten Store — relative Pfade
innerhalb des Slice genügen.

## Schreiben: Store-Operationen (`msg.ui.store`)

Geschrieben wird über den In-Port des `ui-store`-Knotens mit einer
`msg.ui.store`-Message:

```
msg.ui.store.id    = "<id des ui-store>"      ← muss zum Knoten passen
msg.ui.store.op    = "set" | "patch" | "delete" | "replace" | "reset"
msg.ui.store.path  = "<relativer Pfad im Slice>"  ← bei set/patch/delete Pflicht
msg.ui.store.value = <neuer Wert>                 ← bei set/patch/replace Pflicht
msg.ui.clientId    = <optional: nur dieser Client>
```

Operationssemantik:

| `op` | Wirkung | benötigt |
|---|---|---|
| `set` | setzt einen Wert an einem relativen Pfad | `path`, `value` |
| `patch` | merged ein Objekt in einen bestehenden Objektwert (React-freundlich) | `path`, `value` |
| `delete` | entfernt den Wert an einem relativen Pfad | `path` |
| `replace` | ersetzt den kompletten Slice | `value` |
| `reset` | setzt den Slice auf den konfigurierten `initialValue` zurück | — |

`set`/`patch`/`delete` erfordern einen `path`; `set`/`patch`/`replace`
erfordern einen `value` — das Schema (`storeOperationSchema`) lehnt unvollständige
Operationen ab.

### Client-Routing (Multi-User)

`msg.ui.clientId` steuert die Reichweite:

- **gesetzt** → das Update wird nur im State *dieses* Clients angewendet und die Notification nur an ihn gesendet (z. B. Entwurfs-/Formularzustand pro Sitzung).
- **fehlt** → das Update wird an **alle** verbundenen Clients der App gebroadcastet (geteilter Zustand).

Details zum Client-ID-Modell: [multi-user.md](multi-user.md).

### Validierung der Operationen und Fehlermeldungen

Eine Store-Operation hat drei Validierungs-Schichten — wichtig ist, **wo** welche
Regel heute tatsächlich greift.

**1. Contract-Ebene — `storeOperationSchema` (`packages/schema/src/contracts.ts`).**
Definiert die Regeln *und* die sprechenden Meldungen. Eine `StoreOperation` ist
gültig, wenn:

| Regel | Verletzung → Meldung |
|---|---|
| `op` ∈ `set\|patch\|delete\|replace\|reset` | (Zod-Enum-Fehler) |
| `id` ist ein gültiger Bezeichner | (identifierSchema-Meldung) |
| `set` / `patch` / `delete` haben einen `path` | `Store operation '<op>' requires a path.` |
| `set` / `patch` / `replace` haben einen `value` | `Store operation '<op>' requires a value.` |
| ein gesetzter `path` ist nicht leer | `Store operation paths must not be empty.` |

**2. Laufzeit-Ebene — Store-Eingangs-Handler (`nodes/webapp.js`).** Was beim
Empfang einer `msg.ui.store` real passiert:

- `normalizeStoreOperationMessage` akzeptiert die Message nur, wenn `msg.ui.store` ein Objekt ist, `id` zu **diesem** Store passt und `op` ein String ist. Andernfalls gilt sie als „nicht für diesen Store" und wird **unverändert durchgereicht** (kein Fehler).
- **P80 (implementiert):** Vor `applyStoreOperation` läuft `storeOperationSchema.safeParse(operation)`. Bei Misserfolg → strukturierter Fehler `server.store.invalid-operation` mit der ersten Zod-Meldung (z. B. `Store operation 'set' requires a value.`), `done(err)` — kein Weiterleiten.
- Fehlt eine aktive `ui-app` → strukturierter Fehler `server.store.no-active-app`, Meldung **„No active ui-app is registered for ui-store updates."** (severity `error`) und `done(err)`.
- Wirft `applyStoreOperation` (unerwarteter Fehler nach bestandener Schema-Prüfung) → `server.store.operation-failed`, Meldung **„ui-store operation failed: \<Ursache\>"** und `done(err)`.

**3. Editor-Ebene — `statePath`.** Das Schema verlangt einen nicht-leeren
`statePath` (`Stores must declare a state path.`); das Editor-Feld ist
`required`. Die in [ui-store.md](../state/ui-store.md) beschriebenen schärferen
Regeln (nur Bezeichner-Zeichen, App-weit eindeutig) sind die beabsichtigte
Spezifikation.

### Wie und wo Fehler ausgegeben werden (ADR 0006)

Laufzeitfehler des Stores werden über `reportRuntimeError(node, …)` als
**strukturierter Fehler** erzeugt — `{ severity, code, message, context, clientId }`
(siehe [logs-errors.md](logs-errors.md)). Dieser wird:

1. im Node-RED-Runtime geloggt,
2. **opt-in** an den/die Client(s) weitergeleitet (pro `ui-app` konfigurierbar, severity-geschwellt) und dort u. a. über [`ui-log`](../feedback/ui-log.md) sichtbar,
3. zusätzlich über `done(err)` an einen verdrahteten `catch`-Knoten gemeldet.

### Fehler-Codes im Überblick

| Code | Auslöser | Meldung (Beispiel) |
|---|---|---|
| `server.store.invalid-operation` | Operation besteht `storeOperationSchema` nicht (fehlendes `path`/`value`, unbekanntes `op`) | `Store operation 'set' requires a value.` |
| `server.store.no-active-app` | Kein `ui-app`-Knoten registriert | `No active ui-app is registered for ui-store updates.` |
| `server.store.operation-failed` | `applyStoreOperation` wirft nach bestandener Schema-Prüfung (unerwarteter Fehler) | `ui-store operation failed: <Ursache>` |

## Lesen, Variante A: `state`-Binding (roher Pfad)

Eine Komponente kann einen State-Wert direkt über seinen Pfad lesen:

```json
{ "kind": "state", "path": "customers.list" }
```

Das `state`-Binding bindet an einen **rohen Pfad** im Client-State. Da der Slice
eines Stores unter dessen `statePath` liegt, zeigt ein `state`-Binding effektiv
in den Store hinein — aber über den Pfad-String, nicht über die Store-Identität.

## Lesen, Variante B: `store`-Binding (per Store-Referenz) — P67

Das `store`-Binding referenziert einen Store über **seine Knoten-ID** statt über
den rohen Pfad:

```json
{ "kind": "store", "path": "<id des ui-store-Knotens>" }
```

Auflösung zur Laufzeit (`resolveBinding`, `packages/renderer/src/renderer.ts`):

1. `binding.path` enthält die **ui-store-Knoten-ID**.
2. Der Renderer schlägt darüber den `statePath` des Stores nach (Map `storePaths`, aus den Stores der App aufgebaut).
3. Er liest den Live-Wert an diesem `statePath` aus dem Client-State.

**Warum per ID statt per Pfad?** Robustheit: Wird der `statePath` eines Stores
später umbenannt, bleibt das `store`-Binding gültig — es zeigt weiter auf
*denselben Store*. Ein `state`-Binding mit hartem Pfad würde dabei brechen.

```
state-Binding:  { kind:"state", path:"customers.list" }   → bricht, wenn statePath umbenannt wird
store-Binding:  { kind:"store", path:"customersStore" }   → folgt dem Store, egal wie sein statePath heißt
```

Im Editor wird der `store`-Typ über einen **Store-Picker** ausgewählt (filter-/
durchsuchbare Liste der `ui-store`-Knoten derselben App, P68-Picker). Heute ist
der `store`-typedInput-Typ an `ui-alert` (`message`/`title`) verdrahtet (P67);
die Binding-Art selbst ist allgemein und kann auf weitere Felder ausgerollt
werden.

### Unterpfad (`subPath`) — P131 (ADR 0013)

Ein `store`-Binding liest standardmäßig den **ganzen Slice**. Ist der Slice ein
Objekt/Array (z. B. `{a:false, b:false, c:"eins"}`), ist er **nicht direkt
darstellbar** → der zentrale Display-Normalizer (P104) rendert den
Invalid-Value-Marker `"?"`. Damit eine Komponente auf **eine Property** des Slice
binden kann, trägt das `store`-Binding einen optionalen **`subPath`**:

```json
{ "kind": "store", "path": "<ui-store-id>", "subPath": { "kind": "literal", "value": "c" } }
```

Auflösung im Renderer (`resolveBinding`, `case "store"`):

1. Slice wie bisher auflösen (Store-ID → `statePath` → Live-Wert).
2. Ist `subPath` gesetzt: das `subPath`-Binding zu einem **Pfad-String/Index**
   auflösen, dann `getValueAtPath(slice, pfad)`. Punkt-/Klammer-Notation
   (`b.label`, `items.0`, `items[0]`) wird unterstützt; ein **numerisches**
   Segment ist ein **Array-Index**, ein Wort-Segment ein **Objekt-Key** —
   datengetrieben, kein Typ-Entscheid.
3. **Leerer/fehlender** `subPath` ⇒ der ganze Slice (unverändert; korrekt, wenn
   der Slice ein Skalar ist).

#### Ein-Level-Regel (Rekursionssperre)

`subPath` ist selbst ein **Blatt-Value-Binding** und darf **kein eigenes
`subPath`** tragen — das Schema lehnt `subPath.subPath` ab. Damit ist keine
Kette/kein Zyklus möglich. Ein Laufzeit-**Tiefen-Guard** im Renderer ist der
Backstop: würde (nur per Schema-Bypass erreichbar) doch eine Verschachtelung
auftreten, gibt der Renderer **keinen** Stack-Overflow aus, sondern den
Invalid-Value-Marker plus **eine** sprechende Meldung über dieselbe
[reaktive-Fehler-Pipeline](logs-errors.md) (App-weite Dedup wie beim
`reactive`-Binding, zurückgesetzt bei `flows:started`).

#### Drei Stabilitätsklassen des Pfads

Der `subPath` ist ein gebundener Wert aus dem kanonischen Satz
(`literal` string/number · `routeParam` · `query` · `store` · `reactive` ·
`jsonata` · `msg` · `flow` · `global` · `env`). Die Quelle bestimmt das
Stabilitätsverhalten:

| Klasse | Quellen | Verhalten |
|---|---|---|
| reaktiv / stabil | `routeParam`, `query`, `store`, `reactive` | wird je Snapshot neu aufgelöst; übersteht Deploy |
| server-einmalig | `flow`, `global`, `env` | einmal pro Render im Server-Kontext aufgelöst |
| message-getrieben / ephemer | `msg`, `jsonata` | Pfad kommt aus einer Message → leer bis zur nächsten Message, geht bei Deploy/Restart verloren (ADR-0012-Caveat — jetzt auf dem *Pfad*) |

#### Sprechende Laufzeitfehler

Editor permissiv, Laufzeit validiert (Owner-Entscheid). Bei Fehlkonfiguration
gibt der Renderer den Invalid-Value-Marker `"?"` aus und meldet **einmalig**:

- `subPath` gesetzt, aber **unauflösbar** (Key fehlt / Slice ist Skalar) →
  `Store "<name>": Pfad "<p>" nicht gefunden (Slice ist <typ/wert>)`.
- **kein** `subPath`, aber Slice ist ein nicht-darstellbares Objekt/Array →
  `Store "<name>": Wert ist ein Objekt — gib einen Pfad zu einer anzeigbaren Property an`.

> Die Editor-Seite (Store-**Name** statt ID, Pfad-typedInput mit Autocomplete aus
> der Default-Shape) liefert **P132**. P131 ist der Unterbau (Schema, Renderer,
> Runtime-Guard).

## Ausgabe: Änderungs-Notification

Ändert sich ein Store (über Node-RED oder vom Client), emittiert der Knoten auf
seinem Out-Port eine standardisierte Notification (`uiStoreMessageSchema`):

```
msg.ui.store = {
  id, event: "changed", op,
  path, fullPath,
  value, previousValue,
  origin: "node-red" | "client"
}
```

`fullPath` ist der absolute Pfad im Client-State (Slice-`statePath` + relativer
`path`); `origin` unterscheidet flow-getriebene von client-getriebenen
Änderungen. So kann der Flow auf Store-Änderungen reagieren (z. B. abgeleitete
Berechnungen, Persistierung nach außen).

## Initialisierung

`initialValue` wird beim Aufbau des Client-State unter dem `statePath` des Stores
gesetzt (`initializeState`). Ein `reset` stellt genau diesen Wert wieder her.

## Die Binding-Arten im Überblick

Der vollständige Satz der Binding-`kind`s (`bindingSchema`,
`packages/schema/src/contracts.ts`):

| `kind` | liest aus | aufgelöst von |
|---|---|---|
| `literal` | dem Binding selbst (`value`) | Renderer |
| `state` | Client-State per rohem Pfad | Renderer |
| `store` | Client-State per Store-ID → `statePath` | Renderer |
| `query` | Query-State per `queryPath` | Renderer |
| `routeParam` | Routen-Parameter der aktuellen Route | Renderer |
| `reactive` | clientseitiger JS-Ausdruck (`routeParam`/`store(…)`/`query(…)`) | Renderer (kompiliert einmal, wertet je Snapshot aus — ADR 0010, P115) |
| `msg` | eingehender Node-RED-Message (Pfad) | Runtime (Node-RED-Schicht) |
| `flow` | Flow-Context | Runtime |
| `global` | Global-Context | Runtime |
| `jsonata` | JSONata-Ausdruck **gegen die eingehende Message** | Runtime (Input-Handler, message-getrieben) |
| `env` | Environment-Variable | Runtime |

`literal/state/store/query/routeParam/reactive` werden im Renderer aufgelöst;
`flow/global/env` werden an der Node-RED-Laufzeitschicht (webapp.js) einmalig pro
Render aufgelöst. `msg` und `jsonata` sind **message-getrieben**: sie rendern leer,
bis eine passende Message eintrifft; der Input-Handler wertet sie gegen die `msg`
aus (JSONata via `RED.util.prepareJSONataExpression` + asynchroner
`evaluateJSONataExpression`) und schreibt das Ergebnis als Literal in die
Live-Definition. Jedes Binding kann zusätzlich einen `fallback` tragen, der greift,
wenn der aufgelöste Wert `undefined` ist.

### Der kanonische Value-Binding-Typ-Satz (Editor) — ADR 0012 / ADR 0010

Jedes Display-Wert-Feld (z. B. `ui-text` `value`, `ui-alert` `message`/`title`,
`ui-image`/`ui-avatar` `src`) bietet im Editor **EINEN** kanonischen Typsatz in
**dieser Reihenfolge** — aus genau einer Quelle
(`valueBindingTypes()`/`readValueBinding()`/`applyValueBinding()` in
`resources/lib/editor-common.js`):

> **Store, Query, Route-Param, Reactive, msg, JSONata, string, number, boolean,
> json, timestamp, Flow, Global, Env** (Default-Typ: `string`).

Die fünf Literaltypen (`str`/`num`/`bool`/`json`/`date`) serialisieren als
`{ kind: "literal", value: <typisierter Wert> }`; `reactive` als
`{ kind: "reactive", value: <Ausdruck> }`; alle übrigen als `{ kind, path }`.
`state` ist **kein** Editor-Angebot mehr (bleibt aber schema-/renderer-seitig für
Altbestände bestehen). Reduzierte Feld-Kategorien (Boolean-Zustand für `disabled`,
URL/Pfad für `href`/`to`) deklarieren ihre Kategorie und erhalten eine Teilmenge —
siehe ADR 0012.

## Siehe auch

- [`ui-store`](../state/ui-store.md) — Knoten-Referenz (Felder, Editor, In-/Out-Port)
- [messages.md](messages.md) — `msg.ui`-Formate inkl. Store- und Query-Messages
- [inputs.md](inputs.md) — wie Eingabe-Knoten Werte in den State zurückschreiben
- [multi-user.md](multi-user.md) — Client-ID-Routing, Broadcast vs. zielgerichtet
