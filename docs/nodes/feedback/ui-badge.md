# `ui-badge`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-badge` rendert einen **kleinen Status-Indikator oder Markierung**, typischerweise
an einem anderen Element (z. B. an einem Button oder einem Navigations-Eintrag).
Der angezeigte Wert wird über ein Binding aus dem State, einem Store oder der
eingehenden Message bezogen. Die Form (`displayType`) und die semantische
Farbrolle (`variant`) sind unabhängig konfigurierbar.

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
| `value` | „Value Path" | typedInput (Binding-Arten) | **ja** | Der angezeigte Wert (Zahl oder String). Unterstützt alle Binding-Arten (`literal`, `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env`). |
| `displayType` | „Display Type" | SelectBox | optional | Form des Badge — dies ist ein **Darstellungstyp**, kein semantischer Variant (vgl. [theming.md](../concepts/theming.md)). Werte: `rounded` (Default), `pill`, `square`. `pill` → Shoelace `pill`-Attribut (stark abgerundete Enden); `square` → eckiges Badge (via `data-display-type`-CSS). |
| `variant` | „Variant" | SelectBox | optional | Semantische Farbrolle des Badge (Ebene-2-Variant). Werte aus `BADGE_VARIANTS` (`SEVERITY_VARIANTS`): `primary`, `success`, `warning`, `danger`, `neutral` (Default), `info`. Bestimmt gemeinsam mit den Design-Tokens des `ui-app` die Hintergrundfarbe. |
| `pulsating` | „Pulsating" | Checkbox | optional | Lässt das Badge pulsieren, um Aufmerksamkeit zu erzeugen. Shoelace-Backend: natives `pulse`-Attribut auf `sl-badge`. Andere Backends ohne native Unterstützung können einen CSS-Animations-Fallback einsetzen (analog Bootstrap-Beispiel). Das Feld ist bewusst backend-neutral gehalten. |
| `size` | „Size" | SelectBox | optional | Größe des Badge: `sm`, `md`, `lg`. Shoelace-Backend: kein natives `size`-Attribut auf `sl-badge`; die Größe wird als `data-size`-Attribut gesetzt und per CSS gesteuert. Andere Backends können das native Sizing-System nutzen. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-badge"`-Hilfetext soll **knapp, aber ausreichend** sein:
Zweck in 1–2 Sätzen, Hinweis auf `displayType` vs. `variant` (Form vs. Farbrolle),
Hinweis auf Backend-Neutralität von `pulsating` und `size`, sowie ein Link auf
die ausführliche Doku. Empfohlener Link:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/feedback/ui-badge.md`.

## Input

`ui-badge` hat einen **Input-Port** für Push-Updates aus dem Flow.

- **`msg.payload`** — aktualisiert das primäre Feld `value` und pusht sofort einen
  neuen SSE-Snapshot. Weitere Felder bleiben unverändert.
  Details: [inputs.md](../concepts/inputs.md).
- **`msg.ui.patch`** — überschreibt beliebige Felder der Knoten-Definition
  (`value`, `displayType`, `variant`, `pulsating`, `size`).
- **`msg.ui.component.op`** (`show`, `hide`, …) — steuert Sichtbarkeit und
  Interaktionszustand.
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-badge` hat **keinen Output-Port** — der Knoten erzeugt selbst keine
Nutzer-Events.

## Theming

`ui-badge` trägt drei orthogonale Konfigurationen:

- **`displayType`** (`rounded`/`pill`/`square`) — Form (Darstellungstyp, Ebene Rendering),
  kein semantischer Variant. Gehört bewusst nicht in das Variant-Vokabular.
  `pill` → Shoelace `pill`-Attribut; `square` → `data-display-type="square"` (CSS).
- **`variant`** (`BADGE_VARIANTS = SEVERITY_VARIANTS`) — semantische Farbrolle (Ebene 2).
  Das Theme des `ui-app` bildet den Variant über Design-Tokens auf konkrete Farben ab.
  Das Modell ist backend-neutral.
- **`pulsating`** — Aufmerksamkeits-Signal. Backend-neutral; Shoelace unterstützt
  es nativ (`pulse`), andere Backends können einen CSS-Fallback einsetzen.
- **`size`** — Größentoken (sm/md/lg). Backend-neutral; Shoelace emittiert `data-size`.

## Referenzen

- [editor.md](../concepts/editor.md) — Binding-Typen, typedInput
- [theming.md](../concepts/theming.md) — `SEVERITY_VARIANTS`, `displayType` vs. `variant`
- [inputs.md](../concepts/inputs.md) — `msg.payload` Push-Updates

## Test-Katalog

→ [`tests/e2e/nodes/view/ui-badge.tests.md`](../../../tests/e2e/nodes/view/ui-badge.tests.md)

## Offene Punkte

- Positionierung relativ zu einem Referenz-Element (z. B. absolut über einem Button) ist noch nicht modelliert — aktuell wird `ui-badge` als normales gemountetes Kind platziert.
