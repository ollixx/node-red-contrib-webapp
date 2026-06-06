# Fehlerbehandlung & Logging

Grundlage: [ADR 0006](../../adr/0006-error-handling-and-logging.md). Dieses
Dokument fasst zusammen, wie das Framework Fehler behandelt — der ADR ist die
verbindliche Quelle für die Entscheidungen.

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

## Empfang im Browser (P55)

Der Client logt eingehende `error`-Frames über seinen gemeinsamen Logger auf der
getragenen Stufe (mit `[server]`-Präfix und `origin: "server"`), parst eingehende
und ausgehende Messages als `debug`-Trace und logt Lifecycle-Ereignisse als
`info`. Kein `catch` schluckt mehr still.

## `ui-log` (P57)

Ein eigenes View-Element (`ui-log`) zeigt den Fehler-/Log-Stream **innerhalb der
App** an — abgegrenzt von `ui-toast` (flüchtige Nutzer-Benachrichtigung vs.
persistentes, inspizierbares Log). Wird in P57 umgesetzt.
