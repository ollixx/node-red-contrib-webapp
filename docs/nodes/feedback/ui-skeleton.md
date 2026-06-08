# `ui-skeleton`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-skeleton` rendert einen **animierten Lade-Platzhalter**, der die Form des
eigentlichen Inhalts imitiert. Der Knoten ist sichtbar, solange das `visible`-Binding
truthy ist — typischerweise während ein Query lädt oder Daten noch nicht vorhanden
sind. Sobald der Inhalt bereit ist, wird `visible` auf falsy gesetzt und die echten
Komponenten übernehmen. Die Darstellungsform (`displayType`) bestimmt den Umriss des
Platzhalters (Text-Zeilen, Avatar, Card oder Tabelle).

## Einordnung

- **Parent:** eine Route, ein Dialog oder ein Container — via `mount`.
- **Kinder:** keine.
- **Rolle zur Laufzeit:** Lade-Zustand-Indikator; verschwindet, wenn `visible` falsy wird.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor. Default: fortlaufend `Skeleton N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Slot, in den der Knoten gemountet wird (`<type>:<id>/<slot>`). |

### Gruppe „Sichtbarkeit"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `visible` | „Visible Path" | typedInput (Binding-Arten) | **ja** | Binding, das die Sichtbarkeit steuert. `true` = Skeleton sichtbar (Daten werden geladen); `false` = Skeleton verborgen (Inhalt bereit). Unterstützt alle Binding-Arten (`literal`, `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env`). Typischerweise ein `query`- oder `state`-Binding auf einen booleanen „isLoading"-Wert. |

### Gruppe „Darstellung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `displayType` | „Display Type" | SelectBox | optional | Darstellungsform des Platzhalters — dies ist ein **Darstellungstyp**, kein semantischer Variant (vgl. [theming.md](../concepts/theming.md)). Werte: `text` (Default), `avatar`, `card`, `table`. Jede Form imitiert den Umriss der korrespondierenden Komponente. |
| `lines` | „Lines" | Zahlenfeld (≥ 1) | optional | Anzahl simulierter Textzeilen. Nur relevant für `displayType: text`. Default: `3`. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-skeleton"`-Hilfetext soll **knapp, aber ausreichend** sein:
Zweck in 1–2 Sätzen (animierter Platzhalter, Lade-Zustand), Hinweis auf das
`visible`-Binding (wann sichtbar), `displayType` (Darstellungsform, kein Variant)
und `lines` sowie ein Link auf die ausführliche Doku. Empfohlener Link:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/feedback/ui-skeleton.md`.

## Input

`ui-skeleton` hat einen **Input-Port** für Push-Updates aus dem Flow.

- **`msg.ui.patch`** — überschreibt beliebige Felder der Knoten-Definition
  (`displayType`, `lines`).
- **`msg.ui.component.op`** (`show`, `hide`, …) — steuert Sichtbarkeit und
  Interaktionszustand zusätzlich zum `visible`-Binding.
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-skeleton` hat **keinen Output-Port** — der Knoten erzeugt keine Nutzer-Events.

## Theming

`ui-skeleton` hat kein `variant`- und kein `severity`-Feld. Die Animations- und
Platzhalterfarben folgen den neutralen Design-Tokens des `ui-app`-Themes
(`colorNeutral`, `colorSurface`). `displayType` ist ein Darstellungstyp
(Rendering-Form), keine semantische Ebene-2-Rolle — er landet deshalb nicht im
Variant-Vokabular (vgl. [theming.md](../concepts/theming.md)). Das Modell ist
backend-neutral.

## Besonderheiten

- **Komplementär zu den echten Komponenten.** `ui-skeleton` und die eigentlichen
  Komponenten teilen denselben Slot. `visible` des Skeletons und die Sichtbarkeit
  der echten Komponenten sind komplementär — wenn `isLoading` truthy ist, ist das
  Skeleton sichtbar und die echten Inhalte ausgeblendet; ist `isLoading` falsy,
  umgekehrt.

## Referenzen

- [editor.md](../concepts/editor.md) — Binding-Typen, typedInput
- [theming.md](../concepts/theming.md) — `displayType` vs. `variant`, Design-Tokens
- [inputs.md](../concepts/inputs.md) — `msg.ui.patch` Push-Updates
- [`ui-query`](../state/ui-query.md) — typischer Datenquellenknoten für `isLoading`-Bindings
