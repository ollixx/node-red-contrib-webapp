# `ui-progress`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-progress` zeigt einen **Fortschrittsbalken oder Lade-Indikator** an. Die
Darstellungsform (`displayType`) bestimmt, ob ein Balken, ein Spinner oder eine
kreisförmige Anzeige gerendert wird. Der Fortschrittswert wird über ein Binding
aus dem State, einer Query oder der eingehenden Message bezogen. Fehlt der Wert,
wird ein indeterminate (endlos animierter) Zustand angezeigt.

## Einordnung

- **Parent:** eine Route, ein Dialog oder ein Container — via `mount`.
- **Kinder:** keine.
- **Rolle zur Laufzeit:** passives Anzeige-Element für Lade- und Fortschrittszustände.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor. Default: fortlaufend `Progress N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Slot, in den der Knoten gemountet wird (`<type>:<id>/<slot>`). |

### Gruppe „Darstellung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `displayType` | „Display Type" | SelectBox | optional | Darstellungsform des Fortschritts — dies ist ein **Darstellungstyp**, kein semantischer Variant (vgl. [theming.md](../concepts/theming.md)). Werte: `bar` (Default), `spinner`, `circular`. `bar` = horizontaler Balken; `spinner` = rotierendes Icon (indeterminate); `circular` = kreisförmige Anzeige mit Prozentwert. |
| `value` | „Value Path" | typedInput (Binding-Arten) | optional | Fortschrittswert als Zahl zwischen `0` und `100`. Unterstützt alle Binding-Arten (`literal`, `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env`). Fehlt der Wert oder ist er `null`/`undefined`: indeterminate (endlos animiert). |
| `label` | „Label" | Textfeld | optional | Beschriftungstext, der neben oder unter dem Fortschritts-Element angezeigt wird. |
| `showValue` | „Show Value" | Checkbox | optional | Wenn aktiv, wird der aktuelle Prozentwert als Text eingeblendet. Wird bei indeterminate ignoriert. Default: `false`. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-progress"`-Hilfetext soll **knapp, aber ausreichend** sein:
Zweck in 1–2 Sätzen, Erklärung von `displayType` (Darstellungsform, kein Variant)
und `value` (fehlend = indeterminate) sowie ein Link auf die ausführliche Doku.
Empfohlener Link:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/feedback/ui-progress.md`.

## Input

`ui-progress` hat einen **Input-Port** für Push-Updates aus dem Flow.

- **`msg.payload`** — aktualisiert das primäre Feld `value` und pusht sofort einen
  neuen SSE-Snapshot. Weitere Felder bleiben unverändert.
  Details: [inputs.md](../concepts/inputs.md).
- **`msg.ui.patch`** — überschreibt beliebige Felder der Knoten-Definition
  (`value`, `displayType`, `label`, `showValue`).
- **`msg.ui.component.op`** (`show`, `hide`, …) — steuert Sichtbarkeit und
  Interaktionszustand.
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-progress` hat **keinen Output-Port** — der Knoten erzeugt keine Nutzer-Events.

## Theming

`ui-progress` hat kein `variant`- und kein `severity`-Feld. Die Darstellungsfarbe
(z. B. Füllfarbe des Balkens) folgt dem `colorPrimary`-Token des `ui-app`-Themes.
`displayType` ist ein Darstellungstyp (Rendering-Form), keine semantische Ebene-2-Rolle —
er landet deshalb nicht im Variant-Vokabular (vgl. [theming.md](../concepts/theming.md)).
Das Modell ist backend-neutral.

## Referenzen

- [editor.md](../concepts/editor.md) — Binding-Typen, typedInput
- [theming.md](../concepts/theming.md) — `displayType` vs. `variant`, Design-Tokens
- [inputs.md](../concepts/inputs.md) — `msg.payload` Push-Updates

## Offene Punkte

- Eine `severity`-Unterstützung (z. B. grüner Balken bei Erfolg, roter bei Fehler) ist noch nicht modelliert.
- `label` ist heute ein statisches Textfeld; eine Binding-Erweiterung (typedInput) ist für eine spätere Phase vorgesehen.
