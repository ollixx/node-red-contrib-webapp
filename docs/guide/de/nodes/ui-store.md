# ui-store

Ein benannter Slice des Client-States — der eine deklarative Weg, die eigenen
Daten der App zu ändern.

> English: [../../nodes/ui-store.md](../../nodes/ui-store.md)

## Zweck

`ui-store` deklariert einen **benannten Zustands-Slice** im Client-State und ist
der **einzige deklarative Pfad für fachliche Zustandsänderungen**. Ein Store
kann beliebig verschachtelte Werte halten; einzelne Felder werden über relative
Pfade adressiert. Geschrieben wird über Store-Operationen, gelesen über
`state`- / `store`-Bindings. Nutze einen Store für Werte, die der Nutzer oder
ein Formular hält (Entwurf, Auswahl, Toggle); für server-geladene, read-only
Daten → [`ui-query`](ui-query.md).

## Wann einsetzen

- Eigenen veränderbaren Zustand halten: Formular-Entwurf, Auswahl, Toggle,
  Zähler.
- Input-Controls schreiben hinein (zweiseitig), Views lesen daraus.
- Nicht für server-geladene, read-only Daten mit Ladezustand — das ist
  [`ui-query`](ui-query.md).

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor und in Pickern. | Freitext | `Store N` |
| **App** | Die Parent-`ui-app` — Routing-Kontext aller Store-Messages. Pflicht. | App-Referenz | — |
| **State Path** (`statePath`) | Der Slice-Name im Client-State. Ein einzelner Bezeichner (`[A-Za-z0-9_]`, keine Punkte/Slashes) — ein Slice-Name, kein Pfad (z. B. `draft`, `customers`). App-weit eindeutig. Pflicht. | Bezeichner | — |
| **Initial Value JSON** (`initialValue`) | Startwert des Slice, gesetzt beim Aufbau des Client-States und Ziel der `reset`-Operation. | JSON | leer |
| **Persist** (`persist`) | Ob der Slice clientseitig (`localStorage`) persistiert wird — Offline-Resilienz und Resync bei Wiederverbindung. | Checkbox | `false` |
| **Scope** (`scope`) | Schützt das gewollte Schreib-Ziel des Stores. `Any` = keine Prüfung; `Broadcast Only` = weist Messages mit `clientId` ab; `Client Only` = weist Broadcast-Messages ab. Eine Verletzung ist ein `server.store.scope-violation`-Fehler. | `Any` / `Broadcast Only` / `Client Only` | `Any` |

## Eingang

Geschrieben über den In-Port mit einer `msg.ui.store`-Message, deren `id` zu
diesem Knoten passt:

| `op` | Wirkung | benötigt |
|---|---|---|
| `set` | setzt einen Wert an relativem Pfad | `path`, `value` |
| `patch` | React-freundlicher Merge in einen Objektwert | `path`, `value` |
| `delete` | entfernt den Wert an relativem Pfad | `path` |
| `replace` | ersetzt den ganzen Slice | `value` |
| `reset` | setzt den Slice auf `initialValue` zurück | — |

`msg.ui.clientId` gesetzt → Update nur für diesen Client (sonst Broadcast an die
Clients der App). Eine `msg.ui.store` mit unpassender `id` wird **unverändert
durchgereicht**. Unvollständige Operationen und Scope-Verletzungen werden als
strukturierte Fehler gemeldet und an einen verdrahteten `catch`-Knoten
weitergereicht.

## Ausgänge / Events

Ändert sich der Store (über Node-RED oder vom Client), emittiert der Out-Port
eine Änderungs-Notification:

```
msg.ui.store = { id, event: "changed", op, path, fullPath,
                 value, previousValue, origin: "node-red" | "client" }
```

`fullPath` ist der absolute Client-State-Pfad (`statePath` + relativer `path`);
`origin` unterscheidet flow-getriebene von client-getriebenen Änderungen.

## Beispiele

### 1. Ein Store, von einem Text gelesen

Ein Store mit einer initialen Begrüßung; ein `ui-text`, per `state`-Binding
gebunden, zeigt den Wert auf der Startseite.

Flow-Datei: [`examples/guide/ui-store.json`](../../../../examples/guide/ui-store.json)

Import-Anleitung:

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. `examples/guide/ui-store.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideStore/` öffnen — „Hello from the
   store" erscheint.

## Verwandt

- [Bindings & State](../guides/bindings-state.md) — Binding-Arten, Stores, Operationen
- [`ui-store-read`](ui-store-read.md) / [`ui-store-action`](ui-store-action.md) — Store lesen / mutieren
- [`ui-query`](ui-query.md) — server-geladene Daten (Abgrenzung)
- Contract-Doc (intern, Deutsch): `docs/nodes/state/ui-store.md`
