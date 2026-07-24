# ui-log

Ein persistentes, filterbares Panel, das den strukturierten Fehler-/Log-Stream
der App zeigt.

> English (canonical): [nodes/ui-log.md](../../nodes/ui-log.md)

## Zweck

`ui-log` zeigt den **strukturierten Fehler- und Log-Stream** der App als
persistente, inspizierbare Liste im App-Interface. Er abonniert automatisch den
SSE-`error`-Kanal der App und aktualisiert seine Anzeige live, sobald neue
Einträge eintreffen. Einträge sammeln sich in einem FIFO-Ringpuffer; die ältesten
werden verworfen, sobald `maxEntries` überschritten wird.

Er ist **nicht** [`ui-toast`](ui-toast.md): ein Toast ist eine flüchtige
Endnutzer-Benachrichtigung; `ui-log` ist ein persistentes Operator-/Entwickler-
Werkzeug.

> **Voraussetzung (wichtig).** Das Log-Panel bleibt **dauerhaft leer**, solange
> die Parent-`ui-app` nicht **`forwardErrorsToClient: true`** gesetzt hat
> (optional plus `forwardErrorMinSeverity`). Ohne diese App-Einstellung leitet
> der Server keine Fehler über den SSE-Kanal weiter und `ui-log` hat nichts
> anzuzeigen. Aktiviere es zuerst am `ui-app`-Knoten.

## Wann einsetzen

- Operatoren/Entwicklern eine In-App-Sicht auf Framework-Fehler und Log-Einträge
  geben.
- Das Angezeigte nach Schweregrad filtern (`minSeverity`).
- Für eine flüchtige, selbst-schließende Nutzer-Benachrichtigung stattdessen
  [`ui-toast`](ui-toast.md).

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `Log N` |
| **Parent Slot** (`mount`) | Slot, in den der Knoten mountet. Pflicht. | Mount-Pfad | — |
| **Min Severity** (`minSeverity`) | Niedrigster angezeigter Schweregrad; Einträge darunter werden ignoriert. | `debug` (alle), `info`, `warn`, `error` (nur) | `debug` |
| **Max Entries** (`maxEntries`) | Ringpuffer-Größe; ältester Eintrag fällt jenseits der Grenze weg. | Integer ≥ 1 | `50` |
| **Start collapsed** (`collapsed`) | Panel eingeklappt starten (Nutzer kann aufklappen). | Checkbox | aus |
| **Visible** (`visible`) | Basis-Feld — deklarative Sichtbarkeit (bindbarer Boolean). | Boolean-Binding | sichtbar |

`Disabled`, `Color` und `Size` sind N/A (ein Log hat keinen interaktiven Zustand,
rendert keine eigene Farbe und hat keine Größen-Stufen). Es gibt kein
`variant`/`severity` — einzelne Einträge werden nach ihrer eigenen Severity
gestylt.

## Eintragsformat

Jeder SSE-Eintrag folgt der strukturierten Fehler-Form (ADR 0006): `severity`,
`code`, `message`, `context` (`appId`/`nodeId`/`op`), `timestamp` (ISO 8601) und
`origin` (`client`/`server`). Neue Einträge werden **oben** eingefügt (neueste
zuerst).

## Eingang

`ui-log` hat **keinen Eingangs-Port**. Er empfängt Daten nur über den
SSE-`error`-Kanal der Parent-App — es gibt kein Flow-Wiring. (Siehe die
Voraussetzung oben.)

## Ausgänge / Events

Keine — `ui-log` hat keinen Output-Port und emittiert keine Events.

## Beispiele

### 1. Ein Log-Panel mit aktivierter Fehler-Weiterleitung

Eine App mit aktiviertem `forwardErrorsToClient` und einem `ui-log`-Panel; eine
Überschrift hält den Root nicht-leer, solange noch keine Fehler eingetroffen sind.
Löse einen Framework-Fehler in der App aus, um ihn im Panel erscheinen zu sehen.

Flow-Datei: [`examples/guide/ui-log.json`](../../../../examples/guide/ui-log.json)

Import-Anleitung:

1. In Node-RED Menü (☰) → **Import**.
2. `examples/guide/ui-log.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideLog/` öffnen — das Log-Panel ist da
   (leer, bis ein Fehler weitergeleitet wird).

## Verwandt

- [`ui-toast`](ui-toast.md) — eine flüchtige Nutzer-Benachrichtigung (das Gegenstück)
- [`ui-app`](ui-app.md) — wo `forwardErrorsToClient` lebt
- Contract-Doc (intern, deutsch): `docs/nodes/feedback/ui-log.md`
