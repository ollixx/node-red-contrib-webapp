# `ui-log`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-log` zeigt den **strukturierten Fehler- und Log-Stream** der App als
persistente, inspizierbare Liste im App-Interface an. Der Knoten abonniert
automatisch den SSE-`error`-Kanal der App (ADR 0006 §4) und aktualisiert seine
Anzeige live, sobald neue Einträge eintreffen. Einträge akkumulieren sich in einem
FIFO-Ringpuffer; älteste werden verworfen, wenn `maxEntries` überschritten wird.

`ui-log` ist **nicht** `ui-toast`: `ui-toast` erzeugt transiente Nutzer-
Benachrichtigungen mit Auto-Dismiss; `ui-log` ist ein persistentes Operator- und
Entwickler-Werkzeug. Beide Knoten sind konzeptionell getrennt (vgl.
[logs-errors.md](../concepts/logs-errors.md) Abschnitt „`ui-log`").

## Einordnung

- **Parent:** eine Route, ein Dialog oder ein Container — via `mount`.
- **Kinder:** keine.
- **Erreichbarkeit:** sichtbar, solange die App verbunden ist; der Inhalt lebt im Browser-DOM, nicht im SSE-Snapshot.
- **Rolle zur Laufzeit:** Operator-/Entwickler-Werkzeug; zeigt Framework-Fehler und
  Log-Einträge, die der Server über `forwardErrorsToClient: true` freigibt.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor. Default: fortlaufend `Log N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Slot, in den der Knoten gemountet wird (`<type>:<id>/<slot>`). |

### Gruppe „Filter"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `minSeverity` | „Min Severity" | SelectBox | optional | Minimaler Schweregrad, der angezeigt wird. Werte: `debug` (Default — alle Einträge), `info`, `warn`, `error` (nur Fehler). Einträge unterhalb dieser Schwelle werden ignoriert. Entspricht `errorSeveritySchema` aus `packages/schema/src/contracts.ts`. |
| `maxEntries` | „Max Entries" | Zahlenfeld (≥ 1) | optional | Maximale Anzahl gespeicherter Einträge im FIFO-Ringpuffer. Wird die Grenze überschritten, wird der älteste Eintrag entfernt. Default: `50`. |

### Gruppe „Darstellung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `collapsed` | „Start collapsed" | Checkbox | optional | Wenn aktiv, startet das Log-Panel eingeklappt. Der Benutzer kann es auf- und zuklappen. Default: `false`. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-log"`-Hilfetext soll **knapp, aber ausreichend** sein:
Zweck in 1–2 Sätzen (persistentes Operator-Log, Abgrenzung zu `ui-toast`), Hinweis
auf die Abhängigkeit von `forwardErrorsToClient` am `ui-app`-Knoten, Erklärung der
drei Felder (`minSeverity`, `maxEntries`, `collapsed`) sowie ein Link auf die
ausführliche Doku. Empfohlener Link:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/feedback/ui-log.md`.

## Input

`ui-log` hat **keinen Input-Port**. Der Knoten empfängt Daten ausschließlich über
den SSE-`error`-Kanal der Parent-App — Flow-Wiring ist nicht vorgesehen.

Die Voraussetzung für sichtbare Einträge ist, dass die Parent-`ui-app` die
Backend→Frontend-Weiterleitung aktiviert hat (`forwardErrorsToClient: true` plus
`forwardErrorMinSeverity`). Details: [logs-errors.md](../concepts/logs-errors.md).

## Output

`ui-log` hat **keinen Output-Port**.

## Datenquelle und Eintragsformat

Jeder empfangene SSE-Eintrag hat das strukturierte Format aus ADR 0006
(`structuredErrorSchema`):

```
{
  severity:  "debug" | "info" | "warn" | "error",
  code:      string,         // stabiler, gepunkteter Bezeichner
  message:   string,         // menschenlesbar, Kontext inline
  context:   { appId?, nodeId?, op? },
  timestamp: string,         // ISO 8601
  origin:    "client" | "server"
}
```

Einträge werden **oben** in die Liste eingefügt (neueste zuerst). Einträge
unterhalb von `minSeverity` werden verworfen. Sobald die Eintragsanzahl `maxEntries`
überschreitet, wird der älteste Eintrag entfernt.

## Abgrenzung zu `ui-toast`

| | `ui-toast` | `ui-log` |
|---|---|---|
| Lebensdauer | Transient (auto-dismiss nach `duration` ms) | Persistent (Ringpuffer bis `maxEntries`) |
| Zielgruppe | Endbenutzer | Entwickler / Betreiber |
| Datenquelle | eingehende `msg.ui.toast`-Message im Flow | SSE `error`-Kanal automatisch |
| Filterbar | nein | ja (`minSeverity`) |
| Input-Port | ja | nein |

## Theming

`ui-log` hat keine eigenen `severity`- oder `variant`-Felder. Einzelne Einträge
werden nach ihrer `severity` visuell unterschieden (z. B. farbige Severity-Labels).
Das Theme des `ui-app` bestimmt die Farben über `SEVERITY_VARIANTS`-Design-Tokens.
Das Modell ist backend-neutral.

## Referenzen

- [logs-errors.md](../concepts/logs-errors.md) — strukturiertes Fehlerformat (ADR 0006), Backend→Frontend-Weiterleitung
- [`ui-app`](../structure/ui-app.md) — `forwardErrorsToClient` / `forwardErrorMinSeverity`
- [`ui-toast`](ui-toast.md) — transiente Nutzer-Benachrichtigung (Abgrenzung)
- [editor.md](../concepts/editor.md) — Editor-Typen

## Offene Punkte

- Ob und wie client-seitige Fehler (Browser-Konsole) in die Log-Liste aufgenommen werden, ist noch nicht modelliert.
- Persistenz des Log-Inhalts über Page-Reloads hinaus (z. B. via `localStorage`) ist nicht vorgesehen.
- Ein „Clear"-Button zum Leeren der Liste ist noch nicht spezifiziert.
