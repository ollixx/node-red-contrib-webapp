# ui-alert

Eine farbige Hinweisleiste für Info-, Erfolgs-, Warn- oder Fehlermeldungen.

> English (canonical): [nodes/ui-alert.md](../../nodes/ui-alert.md)

## Zweck

`ui-alert` zeigt eine **farbige Hinweisleiste** für Info-, Erfolgs-, Warn- oder
Fehlermeldungen. Nachricht und optionaler Titel sind vollständig bindbar — sie
können aus einem Literal, einem Store, dem State, einer Query, einem
Routen-Parameter oder der eingehenden Node-RED-Message stammen. Der Knoten hat
einen Input-Port für Push-Updates und einen Output-Port für das Dismiss-Ereignis.

## Wann einsetzen

- Eine statische oder datengetriebene Status-Meldung in einer Route, einem
  Dialog oder Container zeigen (Warn-Banner, Erfolgs-Bestätigung).
- Einen vorübergehenden Hinweis nach einer Zeit automatisch ausblenden
  (`duration`), optional mit Countdown-Balken.
- Den Nutzer den Hinweis schließen lassen (`dismissible`) und im Flow darauf
  reagieren.
- Für eine **flüchtige Einblendung**, die über der App schwebt und sich selbst
  ausblendet, stattdessen [`ui-toast`](ui-toast.md) nehmen.

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `Alert N` |
| **Parent Slot** (`mount`) | Slot, in den die Alert mountet. Pflicht. | Mount-Pfad | — |
| **Title** (`title`) | Optionaler Titel über der Nachricht (bindbar). Leer → kein Titel-Bereich. | kanonisches Value-Binding | leer |
| **Message** (`message`) | Der Alert-Text (bindbar). Pflicht. | `literal`, `store`, `state`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env` | leer |
| **Severity** (`severity`) | Semantische Farbrolle (kein separates `variant`). | `primary`, `info`, `success`, `warning`, `danger`, `neutral` | `primary` |
| **Icon** (`icon`) | Icon im Icon-Slot der Alert (bindbar). | `Kein Icon`, `Automatisch` (nach Severity), `Custom …` (beliebiger Icon-Name) | keines |
| **Dismissible** (`dismissible`) | Schließen-Icon (×) zeigen; Schließen feuert das `dismiss`-Event. | Checkbox | aus |
| **Duration (ms)** (`duration`) | Nach N Millisekunden automatisch ausblenden. Leer = kein Auto-Hide. | positiver Integer | leer |
| **Countdown** (`countdown`) | Balken, der die verbleibende Zeit herunterzählt. Nur sinnvoll mit `duration`. | Checkbox | aus |
| **Visible** (`visible`) | Basis-Feld — deklarative Sichtbarkeit (bindbarer Boolean). Fehlt = immer sichtbar. | Boolean-Binding | sichtbar |

`Disabled`, `Color` und `Size` sind N/A (eine Alert hat keinen interaktiven
Zustand; ihre Farbe kommt aus der Severity; sie hat keine Größen-Stufen).

## Das Auto-Icon

Mit **Automatisch (auto)** folgt das Icon der Severity: `info-circle`
(primary/info), `check-circle` (success), `exclamation-triangle` (warning),
`x-circle` (danger), `circle` (neutral). **Custom** nimmt einen beliebigen
Icon-Namen (z. B. `bell`); **Kein Icon** rendert kein Icon.

## Eingang

`ui-alert` **hat einen Eingangs-Port** für Push-Updates:

- **`msg.payload`** (nicht-`null`) überschreibt `message` als Literal und pusht
  einen frischen Snapshot an alle Clients; andere Felder bleiben unverändert.
- **`msg.ui.patch`** — überschreibt beliebige Felder der Knoten-Definition
  (`message`, `severity`, `title`, `dismissible`, …); Binding-Felder als
  Binding-Objekt (`{ "kind": "literal", "value": "…" }`).
- **`msg.ui.component.op`** (`show`, `hide`, `enable`, `disable`, …) — steuert
  Sichtbarkeit/Interaktion wie bei jedem View-Knoten.
- Nicht erkannte / fachfremde Messages werden **unverändert durchgereicht**.

`duration` ist ein deklarativer Schreiber auf den EINEN Sichtbarkeits-Wert der
Alert: nach Ablauf setzt der Knoten `visible = false` (in den gebundenen Store
durchgeschrieben oder in den per-Client-Slot, wenn ungebunden). Erneutes
Schreiben von `true` zeigt sie wieder.

## Ausgänge / Events

`ui-alert` **hat einen Output-Port**. Er emittiert ein `dismiss`-Event, wenn der
Nutzer das Schließen-Icon klickt (nur bei `dismissible: true`);
Pass-Through-Messages verlassen diesen Port unverändert.

| Event | Wann | `msg.ui`-Felder |
|---|---|---|
| `dismiss` | Nutzer klickt das Schließen-Icon | `event: "dismiss"`, `appId`, `clientId`, `sourceId` |

## Beispiele

### 1. Eine schließbare Warn-Alert

Eine Warn-Alert mit Titel, Nachricht und Auto-Icon; der Nutzer kann sie
schließen. Eine schlichte Überschrift steht darüber, damit der App-Root nie leer
ist.

Flow-Datei: [`examples/guide/ui-alert.json`](../../../../examples/guide/ui-alert.json)

Import-Anleitung:

1. In Node-RED Menü (☰) → **Import**.
2. `examples/guide/ui-alert.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideAlert/` öffnen — die Warn-Alert
   erscheint mit Schließen-Button.

## Verwandt

- [`ui-toast`](ui-toast.md) — eine flüchtige, selbst-schließende Pop-up-Meldung
- [`ui-badge`](ui-badge.md) — eine kleine Inline-Status-Pille
- [Bindings & State](../guides/bindings-state.md) — die Binding-Arten, Stores
- Contract-Doc (intern, deutsch): `docs/nodes/feedback/ui-alert.md`
