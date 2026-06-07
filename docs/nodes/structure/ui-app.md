# `ui-app`

## Zusammenfassung

Definiert die Wurzel einer deklarativen Web-App.

Aktuelles Verhalten:
- Es kann mehrere `ui-app` geben.
- Dient als Einstieg für Runtime-API, Renderer und Editor-Strukturansicht.
- Die App ist unter `/webapp/<root>` erreichbar

## Abhängigkeiten

**Parent-Knoten:**
- Keiner. `ui-app` ist der Root-Knoten einer Anwendung.

**Gemeinsam genutzte Services und Komponenten:**
- Runtime-API: stellt den Einstiegspunkt `/webapp/<root>` bereit
- Editor-Strukturansicht: App ist Wurzel der Knotenhierarchie

## Editor

**Pflichtfelder:**
- `root`: der erste URL-Teil der app hinter /webapp, root für diese Anwendung.
  - Validierung: unique über alle ui-app Knoten, valider URL part
- `layout`: Layout-Preset
  - Default: `vertical` (Kinder werden untereinander dargestellt)
  - Presets: `vertical`, `horizontal`, `app`, `grid`, `absolute`

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Wird bei der Darstellung des Knotens und in Auswahlfeldern angezeigt.
  - Default: `"App N"` (fortlaufende Nummer aller ui-app-Knoten, startend bei 1)
- `forwardErrorsToClient` (Checkbox): leitet Framework-Fehler des Backends an
  verbundene Clients weiter (SSE-`error`-Event), wo sie geloggt werden (P55).
  - Default: **aus** (Sicherheit — siehe [ADR 0006](../../adr/0006-error-handling-and-logging.md) §4).
    Anonyme `httpNode`-Besucher erhalten ohne dieses Opt-in keine Server-Interna.
- `forwardErrorMinSeverity` (Auswahl `debug` | `info` | `warn` | `error`): nur
  Fehler ab dieser Stufe werden weitergeleitet. Nur sichtbar/aktiv, wenn
  `forwardErrorsToClient` an ist.
  - Default: `error`.
  - Die weitergeleitete `message` wird **redigiert** (Dateipfade/Stacktraces
    entfernt); nur `code` + Framework-IDs (`appId`/`nodeId`/`op`) reisen mit.
  - Siehe [errors.md](../concepts/errors.md) für das Fehler-/Log-Modell.

## Input

## Output

Konfigurierbare Events — im Editor per Checkbox aktivierbar. Pro aktivem Event ein Out-Port:

| Event | Beschreibung | `msg.ui`-Felder |
|---|---|---|
| `clientConnected` | Ein Client hat die App geöffnet | `event: "clientConnected"`, `clientId` |
| `clientDisconnected` | Ein Client hat die App geschlossen / Verbindung verloren | `event: "clientDisconnected"`, `clientId` |
| `onEnter` | Die implizite Root-Route `/` wurde betreten | `event: "onEnter"`, `route`, `params`, `clientId` |
| `onLeave` | Die implizite Root-Route `/` wurde verlassen | `event: "onLeave"`, `route`, `params`, `clientId` |

Typischer Anwendungsfall für `clientConnected`: initiale Daten für den neuen Client laden und per `clientId` gezielt an ihn senden.

`onEnter` / `onLeave` (P66 / ADR 0007 Amendment): Die `ui-app` besitzt die
implizite Root-Route `/` (Home-Content mountet direkt in die App-Slots, ohne
eigene `ui-route`). Eine an die `ui-app` verdrahtete `navigate`-Action wird daher
wie bei einer `ui-route` behandelt — zur Root navigieren — und emittiert
`onEnter` / `onLeave` beim Root-Eintritt/-Austritt, genau wie eine `ui-route`.

## Besonderheiten

- `ui-app` fungiert als implizite Route `"/"`. View-Knoten (`ui-button`, `ui-text`, `ui-input`, `ui-table`, `ui-container`) können direkt in die Slots der App gehängt werden, ohne dass ein `ui-route`-Knoten dazwischen nötig ist. Einfache Apps ohne Routing brauchen deshalb gar keine `ui-route`-Knoten.
- Das Routing nach `/webapp/<root>` verhält sich ansonsten exakt wie bei `ui-route`. Hier sollte ggf. gemeinsamer Code genutzt werden.

Siehe für das mehrfach genutzte Layout-Konzept auch [layout.md](../concepts/layout.md).

Eine App braucht ein Basis-Layout aus den vorhandenen Standard-Presets.
- Direkte Kinder der App-Slots erhalten je nach Preset zusätzliche Layout-Felder im Editor. Details dazu stehen in [layout.md](../concepts/layout.md).

Offene Spezifikation:
- Soll eine App künftig globale Metadaten wie Theme, Basisroute oder Berechtigungen tragen?
  - Später: Themeauswahl. Erfordert ein Theme-Konzept
  - Authorization ist ein offener Punkt, könnte aber eine Auswahl aus verfügbaren Lösungen sein (OAuth2, OICD, ...)
- Ist genau eine App pro Flow gewollt oder nur genau eine pro zusammenhängendem Deploy-Slice?
  - Es gibt ein Repository pro node-red instanz. Die Knoten sind unabhängig von flows.
