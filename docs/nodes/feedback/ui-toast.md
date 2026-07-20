# `ui-toast`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-toast` zeigt eine **transiente Benachrichtigung** an, die sich nach einer
konfigurierbaren Zeit automatisch schließt. Der Knoten reagiert auf eingehende
`msg.ui.toast`-Messages aus dem Flow; der Inhalt der Benachrichtigung (Text,
Severity, Position, Dauer) wird zur Laufzeit aus der Message bestimmt, nicht aus
dem Node-RED-Config-Snapshot. Default-Werte für Severity, Duration und Position
können am Knoten konfiguriert werden und gelten, wenn die Message die
entsprechenden Felder nicht überschreibt.

`ui-toast` ist **nicht** `ui-log`: `ui-log` ist ein persistentes Operator-Log,
das den SSE-Fehlerkanal anzapft; `ui-toast` ist ein kurzlebiger Endnutzer-Hinweis,
der explizit aus dem Flow ausgelöst wird.

## Einordnung

- **Parent:** genau eine `ui-app` (via `parent`). Toasts erscheinen immer auf App-Ebene — nicht in einem Layout-Slot.
- **Kinder:** keine.
- **Rolle zur Laufzeit:** imperativ ausgelöste Benachrichtigung; kein Teil des deklarativen Slot-Modells.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor. Default: fortlaufend `Toast N`. |
| `parent` | „App" | Node-Picker-Dialog (Preset `apps`) | **ja** | Die Parent-`ui-app`. Toasts erscheinen app-weit, nicht slot-gebunden. |

### Gruppe „Defaults"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `severity` | „Severity" | SelectBox | optional | Default-Farbrolle für Toasts, wenn die Message kein `severity`-Feld enthält. Werte aus `SEVERITY_VARIANTS`: `primary`, `success`, `warning`, `danger`, `neutral`, `info` (Default: `info`). Kann durch `msg.ui.toast.severity` überschrieben werden. |
| `duration` | „Duration (ms)" | Zahlenfeld (≥ 0) | optional | Default-Anzeigedauer in Millisekunden. Ein positiver Wert `N` entfernt den Toast client-seitig nach ~`N` ms aus dem DOM (Auto-Dismiss). `0` **oder** ein nicht gesetzter Wert = **kein** Auto-Dismiss (der Toast bleibt, bis der Nutzer ihn schließt). Das Editor-Feld ist mit `4000` vorbelegt. Kann durch `msg.ui.toast.duration` überschrieben werden. |
| `position` | „Position" | SelectBox | optional | Default-Position der Toast-Anzeige. Werte: `top-right`, `top-center`, `bottom-right` (Default), `bottom-center`. Der Toast wird per `position:fixed` an der konfigurierten Ecke verankert — vertikal `top`/`bottom`, horizontal rechtsbündig (`-right`) bzw. viewport-zentriert (`-center`, via `translateX(-50%)`). Jeder der vier Werte erzeugt eine messbar unterschiedliche Platzierung (CSS-Klasse `webapp-toast--<position>` + berechnete Position). Kann durch `msg.ui.toast.position` überschrieben werden. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-toast"`-Hilfetext soll **knapp, aber ausreichend** sein:
Zweck in 1–2 Sätzen (transiente Benachrichtigung, Auto-Dismiss), das
`msg.ui.toast`-Format (Pflichtfelder / Optionalfelder) sowie ein Link auf die
ausführliche Doku. Empfohlener Link:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/feedback/ui-toast.md`.

## Input

`ui-toast` hat einen **Input-Port**. Der Knoten wird durch eine eingehende Message
ausgelöst, die `msg.ui.toast` trägt.

**Akzeptiertes Message-Format:**

```
msg.ui.toast.message   = string            ← Pflicht: der angezeigte Text
msg.ui.toast.severity  = SEVERITY_VARIANTS ← optional; überschreibt den Editor-Default
msg.ui.toast.position  = "top-right" | "top-center" | "bottom-right" | "bottom-center"
                                           ← optional; überschreibt den Editor-Default
msg.ui.toast.duration  = number (ms)       ← optional; überschreibt den Editor-Default
msg.ui.clientId        = string            ← optional; nur für diesen Client (nicht Broadcast)
```

- **`msg.ui.toast.message`** ist das einzige Pflichtfeld innerhalb von `msg.ui.toast`. Fehlt es, wird die Message als nicht für diesen Knoten bestimmt behandelt und **unverändert durchgereicht**.
- Fehlende optionale Felder (`severity`, `position`, `duration`) fallen auf die am Knoten konfigurierten Defaults zurück.
- **Nicht erkannte / fachfremde Messages** (d. h. Messages ohne `msg.ui.toast.message`) werden **unverändert durchgereicht** (Pass-Through), ohne Fehlerausgabe.
- **`msg.ui.clientId`** steuert die Reichweite: gesetzt → nur dieser Client erhält den Toast; fehlt → Broadcast an alle Clients der App.

## Output

`ui-toast` hat einen **Output-Port**. Pass-Through-Messages (fachfremde Eingaben)
verlassen den Output unverändert. Zusätzlich emittiert der Knoten ein Event, wenn
der Nutzer den Toast manuell schließt (Dismiss-Button):

| Event | Wann | Erzeugte `msg.ui`-Felder | Intention |
|---|---|---|---|
| `dismiss` | Nutzer schließt den Toast manuell | `event: "dismiss"`, `appId`, `clientId`, `sourceId` | Aufräumen / Logging im Flow |

Das `dismiss`-Event wird **nicht** emittiert, wenn der Toast durch Auto-Dismiss
(nach `duration` ms) verschwindet — nur bei explizitem Nutzer-Klick.

## Abgrenzung zu `ui-log`

| | `ui-toast` | `ui-log` |
|---|---|---|
| Lebensdauer | Transient (auto-dismiss nach `duration` ms) | Persistent (Ringpuffer bis `maxEntries`) |
| Zielgruppe | Endbenutzer | Entwickler / Betreiber |
| Datenquelle | `msg.ui.toast` aus dem Flow | SSE `error`-Kanal automatisch |
| Filterbar | nein | ja (`minSeverity`) |
| Input-Port | ja | nein |

## Theming

`ui-toast` trägt seine semantische Farbrolle über `severity` (`SEVERITY_VARIANTS`).
Das Theme des `ui-app` bildet die Severity über Design-Tokens auf Farben ab. Das
Modell ist backend-neutral.

## Referenzen

- [logs-errors.md](../concepts/logs-errors.md) — Abgrenzung `ui-toast` vs. `ui-log`
- [editor.md](../concepts/editor.md) — Node-Picker-Dialog (Preset `apps`)
- [theming.md](../concepts/theming.md) — `SEVERITY_VARIANTS`, Ebene-2-Rollen
- [`ui-log`](ui-log.md) — persistentes Operator-Log (Abgrenzung)

## Offene Punkte

- Stacking mehrerer gleichzeitiger Toasts und maximale Anzahl gleichzeitiger Toasts sind noch nicht spezifiziert.
- Zugänglichkeit (ARIA `role="alert"` / `role="status"`) ist noch nicht im Vertrag verankert.
