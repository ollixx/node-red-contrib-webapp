# ui-badge

Ein kleiner Status-Indikator oder Zähler, meist an einem anderen Element.

> English (canonical): [nodes/ui-badge.md](../../nodes/ui-badge.md)

## Zweck

`ui-badge` rendert einen **kleinen Status-Indikator oder eine Markierung** —
typischerweise ein Zähler oder Label neben einem Button oder Navigations-Eintrag.
Der angezeigte Wert kommt aus einem Binding (State, Store oder der eingehenden
Message). Die Form (`displayType`) und die semantische Farbrolle (`variant`) sind
unabhängig konfigurierbar.

## Wann einsetzen

- Einen Ungelesen-/Zähler-Badge zeigen (Posteingang, Benachrichtigungen,
  Warenkorb).
- Eine kleine Status-Pille zeigen (Aktiv, Entwurf, Fehler), aus einem Binding.
- Für einen seitenbreiten Inline-Hinweis stattdessen [`ui-alert`](ui-alert.md).

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `Badge N` |
| **Parent Slot** (`mount`) | Slot, in den der Knoten mountet. Pflicht. | Mount-Pfad | — |
| **Value** (`value`) | Der angezeigte Wert, Zähler oder Label (bindbar). Pflicht. Leer → leeres Badge; `null`/Objekt → `?`; `0`/`false` sind gültig. | `literal` (str), `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env` | leer |
| **Display Type** (`displayType`) | Die Badge-Form (ein Darstellungstyp, kein semantischer Variant). | `rounded`, `pill` (abgerundete Enden), `square` | `rounded` |
| **Variant** (`variant`) | Die semantische Farbrolle. | `neutral`, `primary`, `info`, `success`, `warning`, `danger` | `neutral` |
| **Pulsating** (`pulsating`) | Lässt das Badge pulsieren (Shoelace `pulse`). | Checkbox | aus |
| **Visible** (`visible`) | Basis-Feld — deklarative Sichtbarkeit (bindbarer Boolean). | Boolean-Binding | sichtbar |

`Disabled` und `Size` sind N/A (ein Badge hat keinen interaktiven Zustand; es gibt
bewusst **kein Size-Feld** — Shoelace hat kein natives Badge-Sizing, Größe wird
falls nötig über Theme/CSS am Einsatzort gelöst).

## Eingang

`ui-badge` **hat einen Eingangs-Port** für Push-Updates:

- **`msg.payload`** aktualisiert `value` und pusht einen frischen Snapshot;
  andere Felder bleiben unverändert.
- **`msg.ui.patch`** — überschreibt Felder (`value`, `displayType`, `variant`,
  `pulsating`).
- **`msg.ui.component.op`** (`show`, `hide`, …) — steuert die Sichtbarkeit.
- Nicht erkannte / fachfremde Messages werden **unverändert durchgereicht**.

## Ausgänge / Events

Keine — `ui-badge` hat keinen Output-Port und emittiert keine Events.

## Beispiele

### 1. Ein pulsierender Zähler-Badge

Ein danger-farbiger Pill-Badge mit „3", der pulsiert, neben einer
„Inbox"-Überschrift.

Flow-Datei: [`examples/guide/ui-badge.json`](../../../../examples/guide/ui-badge.json)

Import-Anleitung:

1. In Node-RED Menü (☰) → **Import**.
2. `examples/guide/ui-badge.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideBadge/` öffnen — ein rotes
   pulsierendes „3"-Badge erscheint.

## Verwandt

- [`ui-alert`](ui-alert.md) — eine seitenbreite Inline-Hinweisleiste
- [Theming & Components](../guides/theming-components.md) — Variants vs. Display-Types
- [Bindings & State](../guides/bindings-state.md) — die Binding-Arten, Stores
- Contract-Doc (intern, deutsch): `docs/nodes/feedback/ui-badge.md`
