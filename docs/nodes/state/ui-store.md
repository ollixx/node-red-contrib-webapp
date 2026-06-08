# `ui-store`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-store` deklariert einen **benannten Zustands-Slice** im Client-State der App
und ist der **einzige deklarative Pfad für fachliche Zustandsänderungen**. Ein
Store kann beliebig verschachtelte Werte halten; auf einzelne Felder wird über
relative Pfade zugegriffen — für mehrere zusammengehörige Felder braucht es
keinen zweiten Store. Geschrieben wird ausschließlich über Store-Operationen,
gelesen über `state`- bzw. `store`-Bindings. Das konzeptionelle Fundament steht
in [stores.md](../concepts/stores.md) — diese Seite ist die Knoten-Referenz.

## Einordnung

- **Parent:** genau eine `ui-app`. Die App ist der Routing-Kontext — sie bestimmt, an welche Clients Notifications gehen und welche eingehenden Messages für diesen Store bestimmt sind. Ohne Parent-App ist der Knoten nicht funktionsfähig.
- **Kinder:** keine. `ui-store` wird nicht gemountet; er ist ein Zustands-Knoten.
- **Bezüge:** `ui-input` schreibt über `storeId` in einen Store; `store`-Bindings lesen einen Store über seine Knoten-ID; `ui-query` kann seine Parameter über ein `params`-Store-Binding beziehen.
- **Rolle zur Laufzeit:** hält einen Slice des Client-State unter seinem `statePath`, wendet Operationen an und emittiert Änderungs-Notifications.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Store N`. |
| `parent` | „App" | Node-Picker-Dialog (Preset Apps) | **ja** | Die Parent-`ui-app`. Bestimmt den Routing-Kontext für alle Store-Messages. |
| `statePath` | „State Path" | Textfeld | **ja** | Name des Slice im Client-State. Ein einzelner Bezeichner (nur `[A-Za-z0-9_]`, keine Punkte oder Slashes) — kein Pfad, sondern ein Slice-Name (z. B. `draft`, `customers`, `session`). Innerhalb derselben App eindeutig. |

### Gruppe „Wert"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `initialValue` | „Initial Value JSON" | Textfeld (JSON) | optional | Startwert des Slice. Wird beim Aufbau des Client-State unter `statePath` gesetzt und ist das Ziel der `reset`-Operation. |
| `persist` | „Persist" | Checkbox | optional | Ob der Slice clientseitig (`localStorage`) persistiert wird — ermöglicht Offline-Resilienz und Resynchronisation bei Wiederverbindung. Default: `false`. Details: [multi-user.md](../concepts/multi-user.md). |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-store"`-Hilfetext im Editor soll **knapp, aber
ausreichend** sein: Zweck (benannter Zustands-Slice, einziger Schreibpfad),
ein Hinweis auf `statePath` (Slice-Name, App-weit eindeutig), das
Operations-Format (`msg.ui.store`) und ein Link auf die ausführliche Doku.
Empfohlener Link (später ggf. Wiki):
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/state/ui-store.md`.

## Input

Geschrieben wird über den In-Port mit einer `msg.ui.store`-Message
(`storeOperationSchema`, [stores.md](../concepts/stores.md)):

```
msg.ui.store.id    = "<id dieses ui-store>"        ← muss zum Knoten passen
msg.ui.store.op    = "set" | "patch" | "delete" | "replace" | "reset"
msg.ui.store.path  = "<relativer Pfad im Slice>"   ← bei set/patch/delete Pflicht
msg.ui.store.value = <neuer Wert>                  ← bei set/patch/replace Pflicht
msg.ui.clientId    = <optional: nur dieser Client>
```

Operationssemantik:

| `op` | Wirkung | benötigt |
|---|---|---|
| `set` | setzt einen Wert an einem relativen Pfad | `path`, `value` |
| `patch` | merged ein Objekt React-freundlich in einen bestehenden Objektwert | `path`, `value` |
| `delete` | entfernt den Wert an einem relativen Pfad | `path` |
| `replace` | ersetzt den kompletten Slice | `value` |
| `reset` | setzt den Slice auf den konfigurierten `initialValue` zurück | — |

- **Validierung:** `set`/`patch`/`delete` erfordern einen `path`; `set`/`patch`/`replace`
  erfordern einen `value`. Unvollständige Operationen werden mit sprechenden
  Meldungen abgelehnt (`Store operation '<op>' requires a path.` / `… requires a value.`)
  — Details und Fehlerpfad: [stores.md](../concepts/stores.md).
- **Client-Routing:** `msg.ui.clientId` gesetzt → Update nur im State dieses
  Clients, Notification nur an ihn; fehlt → Broadcast an alle verbundenen Clients
  der App. Siehe [multi-user.md](../concepts/multi-user.md).
- **Nicht erkannte / fachfremde Messages:** Eine `msg.ui.store`, deren `id` nicht
  zu diesem Store passt (oder die kein gültiges Store-Objekt ist), gilt als „nicht
  für diesen Store" und wird **unverändert durchgereicht** (Pass-Through), ohne
  Fehlerausgabe.
- **Framework-Fehler** (fehlende aktive App, fehlgeschlagene Operation) werden
  gemäß [logs-errors.md](../concepts/logs-errors.md) als strukturierter Fehler
  (`reportRuntimeError`) gemeldet und zusätzlich über `done(err)` an einen
  verdrahteten `catch`-Knoten weitergereicht.

## Output

Ändert sich der Store (über Node-RED oder vom Client), emittiert der Out-Port
eine standardisierte Änderungs-Notification (`uiStoreMessageSchema`):

```
msg.ui.store = {
  id, event: "changed", op,
  path, fullPath,
  value, previousValue,
  origin: "node-red" | "client"
}
```

- `fullPath` ist der absolute Pfad im Client-State (`statePath` + relativer `path`).
- `origin` unterscheidet flow-getriebene von client-getriebenen Änderungen.

**Antizipierte Wiring-Szenarien:**
- `changed` → `function`/Persistenz-Node, das auf Zustandsänderungen reagiert
  (abgeleitete Berechnungen, Persistierung nach außen).
- `changed` mit `origin: "client"` → server-seitige Verarbeitung einer
  client-getriebenen Eingabe (z. B. Validierung eines Formularfeldes).

## Besonderheiten

- **Abgrenzung.** `ui-store` hält und verändert lokalen Zustand; `ui-query`
  beschreibt geladene Datenquellen und deren Ladezustand; `ui-action` ändert nur
  Interaktionszustand, keine Daten.
- **Lesen.** Werte werden nicht über den Store-Knoten gelesen, sondern über
  Bindings: `state` (roher Pfad) oder robust `store` (per Store-ID → `statePath`).
  Vokabular und Auflösung: [stores.md](../concepts/stores.md).
- **Logik gehört in den Flow.** CRUD, Validierung und Berechnung leben im
  verdrahteten Node-RED-Flow — der Store ist nur der Zustandsspeicher.

## Referenzen

- [stores.md](../concepts/stores.md) — Store-Konzept, Bindings, Operationen, Fehler
- [`ui-app`](../structure/ui-app.md) — Parent und Routing-Kontext
- [`ui-query`](ui-query.md) — geladene Datenquellen (Abgrenzung)
- [messages.md](../concepts/messages.md) — `msg.ui.store`-Format
- [multi-user.md](../concepts/multi-user.md) — `clientId`-Routing, Persistenz
- [logs-errors.md](../concepts/logs-errors.md) — strukturierte Fehler

## Offene Punkte

- Initialwerte sollen zusätzlich Node-RED-typisch über typedInput-Felder oder
  eingehende Initialisierungsnachrichten gesetzt werden können.
- Ob `ui-store` später Derived State oder Synchronisationsregeln kapseln soll,
  ist noch nicht entschieden.
