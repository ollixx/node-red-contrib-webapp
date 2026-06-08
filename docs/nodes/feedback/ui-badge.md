# `ui-badge`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-badge` rendert einen **kleinen Zähler oder Status-Indikator**, typischerweise
an einem anderen Element (z. B. an einem Button oder einem Navigations-Eintrag).
Der angezeigte Wert wird über ein Binding aus dem State, einem Store oder der
eingehenden Message bezogen. Die Darstellungsform (`displayType`) und die
semantische Farbrolle (`severity`) sind unabhängig konfigurierbar.

## Einordnung

- **Parent:** eine Route, ein Dialog oder ein Container — via `mount`.
- **Kinder:** keine.
- **Rolle zur Laufzeit:** passives Anzeige-Element; der Knoten selbst emittiert kein Nutzer-Event.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor. Default: fortlaufend `Badge N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Slot, in den der Knoten gemountet wird (`<type>:<id>/<slot>`). |

### Gruppe „Inhalt"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `value` | „Value Path" | typedInput (Binding-Arten) | **ja** | Der angezeigte Wert (Zahl oder String). Unterstützt alle Binding-Arten (`literal`, `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env`). Typischerweise ein Zähler (z. B. Anzahl ungelesener Nachrichten) oder ein Status-String. |
| `displayType` | „Display Type" | SelectBox | optional | Darstellungsform des Badge — dies ist ein **Darstellungstyp**, kein semantischer Variant (vgl. [theming.md](../concepts/theming.md)). Werte: `count` (Default), `dot`, `status`. Bei `dot` wird kein Wert angezeigt, nur ein farbiger Punkt. Bei `status` wird der Wert als Status-Label gerendert. |
| `severity` | „Severity" | SelectBox | optional | Semantische Farbrolle des Badge (Ebene-2-Variant, getragen im Feld `severity`). Werte aus `SEVERITY_VARIANTS`: `primary`, `success`, `warning`, `danger`, `neutral` (Default), `info`. Bestimmt gemeinsam mit den Design-Tokens des `ui-app` die Hintergrundfarbe. |
| `max` | „Max" | Zahlenfeld | optional | Maximalwert für `displayType: count`. Überschreitet der Wert dieses Limit, wird `{max}+` angezeigt. Default: `99`. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-badge"`-Hilfetext soll **knapp, aber ausreichend** sein:
Zweck in 1–2 Sätzen, Hinweis auf `displayType` vs. `severity` (Darstellungsform
vs. Farbrolle) sowie ein Link auf die ausführliche Doku. Empfohlener Link:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/feedback/ui-badge.md`.

## Input

`ui-badge` hat einen **Input-Port** für Push-Updates aus dem Flow.

- **`msg.payload`** — aktualisiert das primäre Feld `value` und pusht sofort einen
  neuen SSE-Snapshot. Weitere Felder bleiben unverändert.
  Details: [inputs.md](../concepts/inputs.md).
- **`msg.ui.patch`** — überschreibt beliebige Felder der Knoten-Definition
  (`value`, `displayType`, `severity`, `max`).
- **`msg.ui.component.op`** (`show`, `hide`, …) — steuert Sichtbarkeit und
  Interaktionszustand.
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-badge` hat **keinen Output-Port** — der Knoten erzeugt selbst keine
Nutzer-Events.

## Theming

`ui-badge` trägt zwei orthogonale Konfigurationen:

- **`displayType`** (`count`/`dot`/`status`) — Darstellungsform (Ebene Rendering),
  kein semantischer Variant. Gehört bewusst nicht in das Variant-Vokabular.
- **`severity`** (`SEVERITY_VARIANTS`) — semantische Farbrolle (Ebene 2). Das Theme
  des `ui-app` bildet die Severity über Design-Tokens auf konkrete Farben ab. Das
  Modell ist backend-neutral.

## Referenzen

- [editor.md](../concepts/editor.md) — Binding-Typen, typedInput
- [theming.md](../concepts/theming.md) — `SEVERITY_VARIANTS`, `displayType` vs. `variant`
- [inputs.md](../concepts/inputs.md) — `msg.payload` Push-Updates

## Offene Punkte

- Positionierung relativ zu einem Referenz-Element (z. B. absolut über einem Button) ist noch nicht modelliert — aktuell wird `ui-badge` als normales gemountetes Kind platziert.
