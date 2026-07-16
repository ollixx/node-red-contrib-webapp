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

#### Basis-Felder (P222, ADR 0015 — vgl. [ui-divider](../display/ui-divider.md))

`ui-progress` rendert die gemeinsame Basis-Feld-Gruppe über
`installBaseFields(config)` (siehe [editor.md](../concepts/editor.md),
Abschnitt „Basis-Felder + Editor-Struktur"):

| Feld | Label | Editor-Typ | Anwendbar | Beschreibung |
|---|---|---|---|---|
| `visible` | „Visible" | Boolean-Zustand-typedInput (ADR-0012-Boolean-Satz) | ja | Sichtbarkeit; leer = sichtbar (Default). Persistiert als Binding-Objekt und wird zur Laufzeit als `visibleIf` ausgewertet (Render-Gate): `false` ⇒ der Fortschritt wird nicht gerendert ([ADR 0037](../../adr/0037-unified-dynamic-state-fields-one-value-many-writers.md)). |
| `disabled` | „Disabled" | — (N/A) | **nein** | Ein Fortschrittsbalken hat keinen interaktiven Zustand — Feld wird disabled mit diesem Hinweis angezeigt. |
| `color` | „Color" | Wert-typedInput (voller Binding-Satz) | ja | Füllfarbe des Fortschritts (Indicator); `ui-progress` trägt kein `variant`, daher ist `color` aktiv. Persistiert als Binding-Objekt (leeres Literal → `null`) und färbt zur Laufzeit die Fortschritts-Anzeige (Shoelace `--indicator-color`); leer ⇒ Theme-Default (`colorPrimary`). Wirkt seit P231 (Schema `...baseFieldsSchema`). |
| `size` | „Size" | — (N/A, im „Erweitert"-Abschnitt) | **nein** | Kein Größen-Stufen-Modell — Feld wird disabled mit diesem Hinweis angezeigt. |

### Gruppe „Darstellung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `displayType` | „Display Type" | SelectBox | optional | Darstellungsform des Fortschritts — dies ist ein **Darstellungstyp**, kein semantischer Variant (vgl. [theming.md](../concepts/theming.md)). Werte: `bar` (Default), `spinner`, `circular`. `bar` = horizontaler Balken (`sl-progress-bar`); `spinner` = rotierendes Icon (`sl-spinner`, immer indeterminate); `circular` = kreisförmige Anzeige (`sl-progress-ring`, mit Prozentwert wenn `showValue`; ohne Wert ⇒ Spinner). |
| `value` | „Value" / „Wert" | typedInput (Binding-Arten, literaler Default-Typ `number`) | optional | Fortschrittswert als Zahl im Bereich `0…max`. Unterstützt alle Binding-Arten (`literal`, `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env`). Fehlt der Wert oder ist er `null`/`undefined`: indeterminate (endlos animiert), **nicht** Wert 0. |
| `label` | „Label" | Wert-typedInput (voller Binding-Satz, P137/ADR 0012) | optional | Beschriftungstext neben/über dem Fortschritt. **Voll bindbar** — Literal, Store, `state`, Query, Route-Param, Reactive, `msg`/JSONata; der Renderer zeigt den aufgelösten Wert. Dient zugleich als a11y-Label. |
| `max` | „Max" | Zahlenfeld | optional | Obere Grenze des Wertebereichs. Default `100`. Der Balken skaliert `value / max` (z. B. `value=50, max=200` → 25 % gefüllt); `showValue` zeigt den Prozentwert relativ zu `max`. Nicht-positive/ungültige Werte fallen serverseitig auf `100` zurück. |
| `showValue` | „Show Value" | Checkbox | optional | Wenn aktiv, wird der aktuelle Prozentwert (relativ zu `max`) als Text eingeblendet. Wird bei indeterminate/Spinner ignoriert. Default: `false`. |

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
  (`value`, `displayType`, `label`, `showValue`, `max`).
- **`msg.ui.component.op`** (`show`, `hide`, …) — steuert Sichtbarkeit und
  Interaktionszustand.
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-progress` hat **keinen Output-Port** — der Knoten erzeugt keine Nutzer-Events.

## Theming

`ui-progress` hat kein `variant`- und kein `severity`-Feld. Die Darstellungsfarbe
(Füllfarbe des Balkens/Rings/Spinners) folgt dem `colorPrimary`-Token des
`ui-app`-Themes, kann aber über das Basis-Feld `color` überschrieben werden
(Shoelace `--indicator-color`).
`displayType` ist ein Darstellungstyp (Rendering-Form), keine semantische Ebene-2-Rolle —
er landet deshalb nicht im Variant-Vokabular (vgl. [theming.md](../concepts/theming.md)).
Das Modell ist backend-neutral.

## Referenzen

- [editor.md](../concepts/editor.md) — Binding-Typen, typedInput
- [theming.md](../concepts/theming.md) — `displayType` vs. `variant`, Design-Tokens
- [inputs.md](../concepts/inputs.md) — `msg.payload` Push-Updates

## Offene Punkte

- Eine `severity`-Unterstützung (z. B. grüner Balken bei Erfolg, roter bei Fehler) ist noch nicht modelliert.
- Eine untere Bereichsgrenze `min` (Wertebereich `min…max` statt `0…max`) ist noch nicht modelliert.
