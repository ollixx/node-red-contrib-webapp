# ui-log

**Kategorie:** webapp view (feedback)  
**Zweck:** Persistenter, inspizierbarer Fehler- und Log-Eintrag-Stream als UI-Element.

## Abgrenzung zu `ui-toast`

| | `ui-toast` | `ui-log` |
|---|---|---|
| Lebensdauer | Transient (auto-dismiss) | Persistent (akkumuliert Einträge) |
| Zielgruppe | Endbenutzer | Entwickler / Betreiber |
| Datenquelle | Flow-Wiring (msg.payload) | SSE-Fehlerkanal (`event: error`) automatisch |
| Filterbar | Nein | Ja (minSeverity) |

## Pflichtfelder

| Feld | Typ | Beschreibung |
|---|---|---|
| `parent` / `mount` | String | Slot in der App-Hierarchie (wie jeder View-Knoten) |

## Optionale Felder

| Feld | Typ | Standard | Beschreibung |
|---|---|---|---|
| `minSeverity` | `"debug" \| "info" \| "warn" \| "error"` | `"debug"` | Minimaler Schweregrad, der angezeigt wird. Einträge unterhalb dieser Schwelle werden gefiltert. |
| `maxEntries` | Integer ≥ 1 | `50` | Maximale Anzahl gespeicherter Einträge. Älteste werden verworfen (FIFO-Ringpuffer). |
| `collapsed` | Boolean | `false` | Startet das Panel eingeklappt. Der Benutzer kann es auf- und zuklappen. |

## Verhalten

- Der Knoten abonniert **automatisch** den SSE-`error`-Kanal der App (ADR 0006 §4, P56).
- Jeder empfangene Eintrag der Form `{ severity, code, message, context, timestamp, origin }` wird als neues Listenelement **oben** eingefügt (neueste Einträge zuerst).
- Einträge unterhalb der `minSeverity`-Schwelle werden ignoriert.
- Sobald `maxEntries` überschritten wird, wird der älteste Eintrag aus dem DOM entfernt.
- Das Panel bleibt auch nach einem Seiten-Snapshot-Update erhalten — der Knoten rendert initial als leere Liste; die Einträge leben nur im Browser-DOM.

## Eingangs- und Ausgangsports

- **Eingang:** keiner (0 Inputs — der Knoten empfängt Daten ausschließlich über SSE, nicht per Flow-Wiring).
- **Ausgang:** keiner (0 Outputs).

## Elternelement

Kann in jeden Slot eingehängt werden, der View-Knoten akzeptiert:
- `route:<path>/<slot>` (z.B. `route:/debug/content`)
- `app:<appId>/<slot>` (z.B. `app:myapp/content`)
- `container:<id>/<slot>`

## Rendering

Rendert als `<sl-details>` (Shoelace Accordion-artiges Details-Element) mit einer `<ul class="webapp-log-entries">` darin. Die Konfigurationsattribute (`data-log-min-severity`, `data-log-max-entries`) werden vom Thin Client gelesen.

Jeder Eintrag im DOM hat die Klasse `webapp-log-entry webapp-log-entry--<severity>` und enthält:
- `<span class="webapp-log-ts">` — Zeitstempel (Sekunden-Genauigkeit)
- `<span class="webapp-log-sev webapp-log-sev--<severity>">` — Schweregradlabel
- `<span class="webapp-log-code">` — Fehlercode (optional)
- `<span class="webapp-log-msg">` — menschenlesbare Nachricht

## Sicherheit

Der Knoten zeigt **nur** Fehler, die der Server explizit über `forwardErrorsToClient: true` freigibt (ADR 0006 §4). Client-seitige Fehler (die die Browser-Konsole schreibt) gelangen **nicht** in die `[data-webapp-log]`-Liste — das wäre ein zu großer Implementierungsaufwand ohne klaren Nutzen. Diese Entscheidung kann in einer späteren Phase überdacht werden.
