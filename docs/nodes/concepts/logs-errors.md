# Logging & Fehlerbehandlung

Grundlage: [ADR 0006](../../adr/0006-error-handling-and-logging.md). Dieses
Dokument fasst zusammen, wie das Framework **loggt** und **Fehler behandelt** —
der ADR ist die verbindliche Quelle für die Entscheidungen.

Logging und Fehlerbehandlung teilen dieselbe strukturierte Form und denselben
Severity-Begriff, deshalb stehen sie zusammen. Zu trennen sind:

- **Logging ohne Fehler-Kontext** — normale Beobachtbarkeit (Lifecycle, Message-Tracing) auf `debug`/`info`. Siehe Abschnitt „Logging ohne Fehler-Kontext (Observability)".
- **Fehlerbehandlung** — Framework-Fehler auf `warn`/`error`, mit optionaler Weiterleitung an den Client. Der übrige Teil dieses Dokuments.

## Geltungsbereich

Das Modell deckt **Framework-Fehler** ab — nicht die Logik-Fehler des
Flow-Autors:

- **Client-Runtime** (`resources/lib/webapp-client.js`): Hydrate-/Render-Fehler,
  fehlerhafte SSE-Frames, fehlgeschlagene `/event`-POSTs, Commands auf nicht
  gerenderte Knoten. (P55)
- **Webapp-Runtime** (`nodes/webapp.js`): `mapConfig`/Schema-Validierung,
  `ui-store`-Operationen, `ui-action`-Command-Bau, Snapshot-Aufbau,
  SSE-Schreibfehler. (P56)

Fehler in einem `function`/`db`/`http`-Knoten des Flows bleiben in der Domäne des
Flows und werden mit gewöhnlichen Node-RED-`catch`-Knoten behandelt
(`docs/nodes/concepts/events.md`: „Der Flow ist der einzige Ort für Logik.").

## Strukturierte Fehlerform (ADR 0006 §1)

Eine einzige Form ist die Quelle der Wahrheit für Client, Runtime und das
`ui-log`-Element (P57). Sie wird aus `packages/schema` exportiert
(`structuredErrorSchema`):

```
{
  severity:  "debug" | "info" | "warn" | "error",
  code:      string,        // stabil, greppbar, z.B. "server.store.operation-failed"
  message:   string,        // menschenlesbar, Kontext bereits eingebettet
  context:   { appId?, nodeId?, op? },
  timestamp: string,        // ISO 8601
  origin:    "client" | "server"
}
```

- `severity` ist die **einzige** Stufe, die auf eine Konsolenmethode
  (`console.debug/info/warn/error`) und auf die Weiterleitungs-Schwelle abbildet.
- `code` ist ein stabiler, gepunkteter Bezeichner (`<origin>.<area>.<reason>`),
  damit Fehler über Client- und Server-Logs greppbar sind. Nicht für Endnutzer.
- `message` enthält den Kontext bereits inline; `context` trägt dieselben Fakten
  strukturiert (für Filter und das `ui-log`-Element).

## Runtime-Logging (P56)

Jeder Framework-Fehler im Backend wird **mit Kontext** über `node.error` /
`node.warn` geloggt (nie nackt). Die Stufe bestimmt die Logger-Methode
(`warn` → `node.warn`, sonst `node.error`). Steht kein Knoten zur Verfügung,
greift `RED.log`.

Abgedeckte Pfade (vormals nackt/still):

| Pfad | `code` |
|---|---|
| `mapConfig` wirft | `server.mapConfig.failed` |
| Schema-Validierung schlägt fehl | `server.validation.failed` |
| `ui-store`-Operation wirft | `server.store.operation-failed` |
| keine aktive `ui-app` für Store-Update | `server.store.no-active-app` |
| Snapshot-Aufbau schlägt fehl (Push) | `server.snapshot.build-failed` |
| SSE-Schreibfehler | (geloggt via `RED.log.warn`, nicht weitergeleitet) |
| Navigation auf geschützte Route abgewiesen (P262, `warn`) | `server.auth.navigation-denied` |
| `/event` an geschützte Route/Dialog abgelehnt (P262, `warn`; auch der 403-Response-Body trägt die strukturierte Form) | `server.auth.event-denied` |

## Backend → Frontend Weiterleitung (ADR 0006 §4)

Server-Fehler können **konfigurierbar** an verbundene Clients weitergeleitet
werden — über ein neues SSE-`error`-Event auf dem bestehenden Stream
(`GET /webapp/:appId/stream`). Die weitergeleitete Nutzlast hat
`origin: "server"`.

Pro `ui-app` konfiguriert (siehe [ui-app.md](../structure/ui-app.md)):

- `forwardErrorsToClient` (boolean, Default **false**).
- `forwardErrorMinSeverity` (Default `error`) — nur Einträge ab dieser Stufe.
- **Redaktion**: Die weitergeleitete `message` wird bereinigt (Stacktraces,
  Dateipfade entfernt). `context` trägt nur Framework-IDs.

**Sicherheit.** Die `/webapp/:appId/*`-Routen sind anonyme `httpNode`-Endpunkte.
Default-aus + Schwelle + Redaktion machen die Brücke zu einem bewussten,
abgegrenzten Opt-in statt zu einem stillen Leck. Gezielte Zustellung an einen
Client nutzt die `clientId`-Adressierung (P15).

## Steuerung am `ui-app` (Logging-Select, P61)

Die Weiterleitung wird pro App über **eine einzige „Logging"-Select** im
`ui-app`-Editor gesteuert (nicht über zwei getrennte Felder). Ein Info-Icon neben
dem Label öffnet einen Dialog mit der Erklärung.

| Select-Wert | `forwardErrorsToClient` | `forwardErrorMinSeverity` |
|---|---|---|
| `aus` (Default) | `false` | unverändert |
| `debug` | `true` | `debug` |
| `info` | `true` | `info` |
| `warn` | `true` | `warn` |
| `error` | `true` | `error` |

`aus` schaltet die Weiterleitung ab; jede Severity schaltet sie ein und setzt
zugleich die Schwelle. Die zwei Schema-Felder (`forwardErrorsToClient`,
`forwardErrorMinSeverity`) bleiben der gespeicherte Vertrag — die Select ist nur
die Editor-Oberfläche darüber (Details: [ui-app.md](../structure/ui-app.md)).

> Hinweis: Diese Steuerung betrifft nur die **Backend→Frontend-Weiterleitung**.
> Die Verbosität des Server-Logs selbst (`node.debug/info/warn/error`) folgt der
> Node-RED-Logger-Konfiguration in `settings.js` (`logging.console.level`), nicht
> diesem Feld.

## Empfang im Browser (P55)

Der Client logt eingehende `error`-Frames über seinen gemeinsamen Logger auf der
getragenen Stufe (mit `[server]`-Präfix und `origin: "server"`), parst eingehende
und ausgehende Messages als `debug`-Trace und logt Lifecycle-Ereignisse als
`info`. Kein `catch` schluckt mehr still.

## Logging ohne Fehler-Kontext (Observability, P55)

Nicht jedes Log ist ein Fehler. Der Client (`resources/lib/webapp-client.js`)
besitzt einen **gemeinsamen Logger** in der ADR-0006-Form, der auch den
Normalbetrieb beobachtbar macht — auf den unteren Stufen, ohne die Default-Konsole
zu fluten.

- **Severity → Konsolenmethode:** `debug`→`console.debug`, `info`→`console.info`, `warn`→`console.warn`, `error`→`console.error`.
- **Message-Tracing (DEBUG):** jeder ein-/ausgehende Frame wird auf `debug` getract — ausgehend `→ POST /event`, `→ GET /snapshot`; eingehend `← snapshot`, `← command`, `← toast`. So ist der komplette Client↔Server-Verkehr in den DevTools nachvollziehbar.
- **Lifecycle (INFO):** SSE-Verbindung offen/getrennt/Reconnect werden auf `info` geloggt.
- **Filterbarkeit:** jede Zeile trägt das Präfix `[webapp:<appId>]` und als zweites Argument ein Kontext-Objekt `{ appId, op[, detail] }`. So findet ein DevTools-Filter auf die `appId` alle Meldungen einer App ohne grep.
- **Robust:** der Logger wirft nie; fehlt `console`, ist er ein No-op.

**Verbosität steuern.** Das `debug`-Tracing landet in `console.debug` und ist in
den DevTools über den Level-Filter ein-/ausblendbar — es gibt clientseitig keinen
separaten Schalter. Server-seitig bestimmt die Node-RED-Logger-Stufe
(`settings.js` → `logging.console.level`), bis zu welcher Stufe `node.*`-Logs
erscheinen.

> Abgrenzung: Dies ist Framework-Observability. Fachliches Logging eines Flows
> bleibt Sache des Flows (gewöhnliche `debug`-Knoten / `node.log`).

## `ui-log` (P57)

Ein eigenes View-Element (`ui-log`) zeigt den Fehler-/Log-Stream **innerhalb der
App** an — abgegrenzt von `ui-toast` (flüchtige Nutzer-Benachrichtigung vs.
persistentes, inspizierbares Log). Wird in P57 umgesetzt.
