# `ui-alert`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-alert` zeigt eine **farbige Hinweisleiste** für Info-, Warn-, Erfolgs- oder
Fehlermeldungen an. Nachricht und optionaler Titel sind vollständig bindbar —
sie können aus einem Literal, einem Store, dem State, einer Query, einem
Routen-Parameter oder der eingehenden Node-RED-Message stammen. Der Knoten hat
einen Input-Port für Push-Updates und einen Output-Port für das Dismiss-Ereignis.

## Einordnung

- **Parent:** eine Route, ein Dialog oder ein Container — via `mount`.
- **Kinder:** keine.
- **Erreichbarkeit:** sichtbar, solange das `visible`-Binding truthy ist (Binding optional; fehlt es, ist die Alert immer sichtbar).
- **Rolle zur Laufzeit:** statisches oder datengetriebenes Feedback-Element.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt (typedInput,
Binding-Arten, Node-Picker-Dialog, SelectBox).

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor. Default: fortlaufend `Alert N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Slot, in den der Knoten gemountet wird (`<type>:<id>/<slot>`). |

### Gruppe „Inhalt"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `message` | „Message" | typedInput (alle Binding-Arten inkl. `store`) | **ja** | Anzeigetext der Alert. Unterstützt `literal`, `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env`. Der `store`-Typ referenziert einen `ui-store`-Knoten per Picker (P68); der Renderer löst ihn über dessen `statePath` auf. |
| `title` | „Title" | typedInput (alle Binding-Arten inkl. `store`) | optional | Optionaler Titel über dem Meldungstext. Gleiche Binding-Arten wie `message`. Leer gelassen → kein Titel-Bereich gerendert. |
| `severity` | „Severity" | SelectBox | optional | Semantische Farbrolle der Alert. Werte aus `SEVERITY_VARIANTS`: `primary` (Default), `success`, `warning`, `danger`, `neutral`, `info`. `info` ist ein eigenständiger Wert. Bestimmt gemeinsam mit den Design-Tokens des `ui-app` die Darstellungsfarbe. |
| `dismissible` | „Dismissible" | Checkbox | optional | Wenn aktiv, zeigt die Alert ein Schließen-Icon; der Nutzer kann die Alert wegklicken. Das Dismiss-Ereignis wird auf dem Output-Port emittiert. Default: `false`. |
| `icon` | „Icon" | SelectBox / Freitext | optional | Steuert das Icon im Shoelace-`icon`-Slot. `"auto"` → Severity-abhängiges Bootstrap-Icon: `primary`/`info` → `info-circle`, `success` → `check-circle`, `warning` → `exclamation-triangle`, `danger` → `x-circle`, `neutral` → `circle`. `"none"` oder leer (Default) → kein Icon. Jeder andere Wert wird als Icon-Name (z. B. `"bell"`) oder `{ library, name }`-Objekt interpretiert. Das Feld ist binding-fähig (alle Binding-Arten, wie `message`). |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-alert"`-Hilfetext soll **knapp, aber ausreichend** sein:
Zweck in 1–2 Sätzen, Hinweis auf die vollständige Bindbarkeit von Message und
Title (inkl. Store-Picker), Erklärung von `severity` und `dismissible` sowie ein
Link auf die ausführliche Doku. Empfohlener Link:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/feedback/ui-alert.md`.

## Input

`ui-alert` hat einen **Input-Port** für Push-Updates aus dem Flow.

- **`msg.payload`** — aktualisiert das primäre Feld `message` als Literal und
  pusht sofort einen neuen SSE-Snapshot. Weitere Felder bleiben unverändert.
  Details: [inputs.md](../concepts/inputs.md).
- **`msg.ui.patch`** — überschreibt beliebige Felder der Knoten-Definition
  (`message`, `severity`, `title`, `dismissible` u. a.). Binding-Felder müssen
  als Binding-Objekt geliefert werden (`{ "kind": "literal", "value": "…" }`);
  für einfache Literal-Updates ist `msg.payload` einfacher.
- **`msg.ui.component.op`** (`show`, `hide`, `enable`, `disable`, …) — steuert
  Sichtbarkeit und Interaktionszustand wie bei allen View-Knoten.
- **Validierung:** keine für fachfremde Messages.
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-alert` hat einen **Output-Port**. Er emittiert ein Ereignis, wenn der Nutzer
die Alert dismisst (nur wenn `dismissible: true`). Pass-Through-Messages verlassen
ebenfalls diesen Port — unverändert.

| Event | Wann | Erzeugte `msg.ui`-Felder | Intention |
|---|---|---|---|
| `dismiss` | Nutzer klickt das Schließen-Icon | `event: "dismiss"`, `appId`, `clientId`, `sourceId` | Alert-Zustand im Flow zurücksetzen oder Alert verbergen |

Feldsemantik (`appId`, `clientId`, `sourceId`) wie im allgemeinen Event-Format —
siehe [events.md](../concepts/events.md).

## Theming

`ui-alert` trägt seine semantische Farbrolle im Feld `severity` (`SEVERITY_VARIANTS`).
Das Theme von `ui-app` legt über Design-Tokens (`colorSuccess`, `colorWarning`,
`colorDanger`, `colorPrimary`, …) fest, wie die jeweilige Severity konkret
aussieht. Das Modell ist backend-neutral; ein zukünftiger Adapter (Material o. ä.)
bildet dieselben `severity`-Werte auf sein System ab.

`ui-alert` hat kein `variant`-Feld — `severity` übernimmt die Ebene-2-Rolle,
da Alerts eine Status-/Schweregrad-Semantik tragen.

## Besonderheiten

- **Vollständige Bindbarkeit.** Sowohl `message` als auch `title` sind
  typedInput-Bindings (alle Binding-Arten inkl. `store` per Picker P68). Statische
  Strings werden als `{ kind: "literal", value }` persistiert — die Node-RED-Defaults-
  Auto-Übernahme wird durch ein separates Binding-Feld verhindert (Muster wie bei
  `ui-text`).
- **`visible`-Binding.** Steuert die Sichtbarkeit deklarativ über den State oder
  einen Store, ohne explizite `show`/`hide`-Actions zu benötigen.

## Referenzen

- [editor.md](../concepts/editor.md) — typedInput-Binding-Typen, Node-Picker-Dialog (P68)
- [stores.md](../concepts/stores.md) — `store`-Binding, Auflösung per Store-ID
- [theming.md](../concepts/theming.md) — `SEVERITY_VARIANTS`, Ebene-2-Rollen
- [inputs.md](../concepts/inputs.md) — `msg.payload` / `msg.ui.patch` Push-Updates
- [events.md](../concepts/events.md) — Output-Port und Event-Format

## Offene Punkte

- Auto-Hide nach konfigurierbarer Dauer (analog `ui-toast`) ist noch nicht modelliert.
- Das `visible`-Binding hat kein eigenes Editor-Feld; es wird ausschließlich via `msg.ui.patch` oder Store-gesteuertem Wert gesetzt.
