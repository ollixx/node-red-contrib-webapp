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

### Gruppe „Allgemein" (Base-Fields, ADR 0015 §3)

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `visible` | „Visible" | typedInput (Boolean-Binding-Satz) | optional | Binding, das die Sichtbarkeit steuert. `true` = Skeleton sichtbar (Daten werden geladen); `false` = Skeleton verborgen (Inhalt bereit). **Leer = immer sichtbar** (neutraler Default `true`). Unterstützt den Boolean-Satz (`boolean`, `state`, `store`, `query`, `routeParam`, `msg`, `jsonata`, `flow`, `global`, `env`). Typischerweise ein `query`- oder `store`-Binding auf einen booleanen „isLoading"-Wert. Legacy: ein bestehendes `visiblePath` (Plain-State-Pfad) wird verlustfrei als `state`-Binding übernommen. |
| `color` | „Color" | typedInput (Wert-Binding + Theme-Token) | optional | **Wirksam** (ADR 0039): färbt die Platzhalter-/Shimmer-Fläche (`sl-skeleton --color`). Akzeptiert einen Theme-Token (`token:primary` …), einen semantischen Token (bare word) oder einen CSS-Farbwert; leer = neutrale Theme-Farbe (Shoelace-Default). |
| `disabled` | „Disabled" | — (N/A) | — | **Nicht anwendbar** — ein Lade-Platzhalter ist nicht interaktiv. Im Editor gerendert, aber deaktiviert mit Hinweis (ADR 0015 §3). |

### Gruppe „Darstellung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `displayType` | „Display Type" | SelectBox | optional | Darstellungsform des Platzhalters — dies ist ein **Darstellungstyp**, kein semantischer Variant (vgl. [theming.md](../concepts/theming.md)). Werte: `text` (Default), `avatar`, `card`, `table`. Beobachtbare Render-Wirkung: **`text`** → `lines` Platzhalter-Zeilen, vertikal untereinander gestapelt; **`avatar`** → ein **rundes** Platzhalter-Element (Breite = Höhe, `border-radius` 50 %); **`card`** → ein Block-Platzhalter (Medien-Block + Zeilen in einer umrandeten Box), **höher und breiter** als eine einzelne Text-Zeile; **`table`** → **`lines` Zeilen à 3 Spalten** (Zellen-Platzhalter), unterscheidbar von `text`. |
| `lines` | „Lines" | Zahlenfeld (≥ 1) | optional | Anzahl simulierter Zeilen. Wirkt für **`text`** (Anzahl Text-Zeilen) **und `table`** (Anzahl Tabellen-Zeilen, je 3 Spalten). Für `avatar`/`card` ohne Wirkung (Feld im Editor deaktiviert mit Hinweis). Default: `3`. **Validierung:** ganze Zahl **≥ 1** — `0`/negativ ist ein **Editor-Validierungsfehler** (Knoten rot, Deploy blockiert), nicht erst zur Schema-/Deploy-Zeit. |

### Gruppe „Platzierung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` / `row` / `col` / `colSize` / `rowSize` / `layoutX` / `layoutY` | (Platzierungs-Felder) | Zahlenfelder | optional | Standard-Platzierung im übergeordneten Layout (Reihenfolge; Grid-Zelle/-Spanne; absolute Position). Via `installLayoutChildPropRows()`, identisch zu den übrigen Kind-Knoten. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-skeleton"`-Hilfetext soll **knapp, aber ausreichend** sein:
Zweck in 1–2 Sätzen (animierter Platzhalter, Lade-Zustand), Hinweis auf das
`visible`-Binding (wann sichtbar), `displayType` (Darstellungsform, kein Variant)
und `lines` (Text + Table), `color` (Platzhalter-Farbe) sowie ein Link auf die
ausführliche Doku. Er darf **keine** internen Phasen-Ids an Nutzer leaken.
Empfohlener Link:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/feedback/ui-skeleton.md`.

## Input

`ui-skeleton` hat einen **Input-Port** für Push-Updates aus dem Flow. Er nutzt den
`componentStateInputHandler` — d. h. **heute** verarbeitet er ausschließlich:

- **`msg.ui.component.op`** (`show`, `hide`, `enable`, `disable`, …) — steuert
  Sichtbarkeits-/Interaktionszustand zusätzlich zum `visible`-Binding.
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

> **`msg.ui.patch` wird derzeit NICHT unterstützt.** Anders als patch-fähige
> View-Knoten (`viewNodePatchInputHandler`) überschreibt eine eingehende Message
> **keine** Definitions-Felder (`displayType`, `lines`). Ob `ui-skeleton` künftig
> `msg.ui.patch` erhalten soll, ist eine offene, knotenübergreifende Owner-
> Entscheidung (dieselbe wie der `msg.payload`-Follow-up bei `ui-icon`); sie wird
> **nicht** in diesem Konformitäts-Pass getroffen. Diese Doku beschreibt das
> **heutige** Verhalten.

## Output

`ui-skeleton` hat **keinen Output-Port** — der Knoten erzeugt keine Nutzer-Events.

## Theming

`ui-skeleton` hat kein `variant`- und kein `severity`-Feld. Ohne gesetztes `color`
folgen Animations- und Platzhalterfarben dem neutralen Shoelace-Default
(`--sl-color-neutral-200`). Das **Base-Field `color`** (ADR 0039) überschreibt die
Platzhalter-/Shimmer-Fläche (`sl-skeleton --color`) — es ist der Standard-
Farbregler, **nicht** N/A. `displayType` ist ein Darstellungstyp (Rendering-Form),
keine semantische Ebene-2-Rolle — er landet deshalb nicht im Variant-Vokabular
(vgl. [theming.md](../concepts/theming.md)). Das Modell ist backend-neutral: die
vier `displayType`-Formen werden erst im Serializer/Adapter zu einer Komposition
mehrerer `sl-skeleton` (ADR 0021).

## Besonderheiten

- **Komplementär zu den echten Komponenten.** `ui-skeleton` und die eigentlichen
  Komponenten teilen denselben Slot. `visible` des Skeletons und die Sichtbarkeit
  der echten Komponenten sind komplementär — wenn `isLoading` truthy ist, ist das
  Skeleton sichtbar und die echten Inhalte ausgeblendet; ist `isLoading` falsy,
  umgekehrt.

## Referenzen

- [editor.md](../concepts/editor.md) — Binding-Typen, typedInput, Base-Fields
- [theming.md](../concepts/theming.md) — `displayType` vs. `variant`, Design-Tokens, `color`
- [inputs.md](../concepts/inputs.md) — `msg.ui.component.op` Push-Updates (patch: s. Input)
- [`ui-query`](../state/ui-query.md) — typischer Datenquellenknoten für `isLoading`-Bindings
