# ui-empty-state

Ein strukturierter Platzhalter für leere Listen, fehlgeschlagene Ladevorgänge
oder fehlende Inhalte.

> English (canonical): [nodes/ui-empty-state.md](../../nodes/ui-empty-state.md)

## Zweck

`ui-empty-state` rendert einen **strukturierten Platzhalter** — ein Icon, einen
Titel, eine Nachricht und einen optionalen Call-to-Action-Button — für leere
Listen, fehlgeschlagene Ladevorgänge oder noch nicht vorhandene Inhalte. Er
erscheint, solange sein Sichtbarkeits-Binding truthy ist, typischerweise wenn
eine Liste leer ist oder ein Query nichts zurückgab.

> **Hinweis zur aktuellen Form.** Ein Redesign dieses Knotens ist geplant (P152,
> derzeit zurückgestellt). Die Felder unten beschreiben den Knoten **wie er heute
> ist** — `title`, `message` und `icon` sind Textfelder (keine Bindings), und
> `action` ist eine einfache `ui-action`-Knoten-ID. Diese Seite macht keine
> Zusage über die künftige Form.

## Wann einsetzen

- Einen freundlichen „Hier ist noch nichts"-Platzhalter zeigen, wenn eine
  Liste/Query leer ist.
- Einen Call-to-Action anbieten (z. B. „Ersten Eintrag anlegen"), verdrahtet mit
  einer `ui-action`.
- Für einen Lade-Platzhalter, der die Form von Inhalt nachahmt, stattdessen
  [`ui-skeleton`](ui-skeleton.md).

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `Empty State N` |
| **Parent Slot** (`mount`) | Slot, in den der Knoten mountet. Pflicht. | Mount-Pfad | — |
| **Visible Path** (`visiblePath`) | State-Pfad, der die Sichtbarkeit steuert. Truthy = Empty-State sichtbar (keine Daten / Fehler). Pflicht. | einfacher State-Pfad | — |
| **Icon** (`icon`) | Icon-Name aus dem Shoelace-Set. Leer → kein Icon. | Text | leer |
| **Title** (`title`) | Die Platzhalter-Überschrift (z. B. „Keine Einträge"). Einfacher Text. | Text | leer |
| **Message** (`message`) | Ergänzender Text unter dem Titel. Einfacher Text. | Text | leer |
| **Action** (`action`) | Eine `ui-action`-Knoten-ID; gesetzt → ein CTA-Button wird gerendert. | ui-action-ID | leer |
| **Action Label** (`actionLabel`) | Die CTA-Button-Beschriftung. Nur sichtbar, wenn `action` gesetzt ist. | Text | leer |
| **Color** (`color`) | Basis-Feld — Text-/Icon-Farbe (bindbar). | Value-Binding | Theme |

`Disabled` und `Size` sind N/A (ein Empty-State hat keinen interaktiven Zustand
und keine Größen-Stufen). Es gibt kein `variant`/`severity` — der Knoten
übernimmt das Theme der Parent-App. Sichtbarkeit ist das knoten-eigene
`Visible Path`-Feld (die geteilte `visible`-Basiszeile ist hier ausgelassen).

## Eingang

`ui-empty-state` **hat einen Eingangs-Port** für Push-Updates:

- **`msg.ui.patch`** — überschreibt Felder (`icon`, `title`, `message`,
  `actionLabel`).
- **`msg.ui.component.op`** (`show`, `hide`, …) — steuert die Sichtbarkeit
  zusätzlich zum `Visible Path`-Binding.
- Nicht erkannte / fachfremde Messages werden **unverändert durchgereicht**.

## Ausgänge / Events

Keine — `ui-empty-state` hat keinen Output-Port. Ein Klick auf den CTA-Button
löst die verdrahtete `ui-action` aus; deren Events entstehen dort.

## Beispiele

### 1. Ein store-gesteuerter Empty-State

Ein `ui-store` seedet `isEmpty = true`; der `Visible Path` des Empty-States zeigt
darauf, sodass der Icon-/Titel-/Nachricht-Platzhalter erscheint. Eine Überschrift
steht darüber.

Flow-Datei: [`examples/guide/ui-empty-state.json`](../../../../examples/guide/ui-empty-state.json)

Import-Anleitung:

1. In Node-RED Menü (☰) → **Import**.
2. `examples/guide/ui-empty-state.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideEmpty/` öffnen — der
   „No customers yet"-Platzhalter erscheint.

## Verwandt

- [`ui-skeleton`](ui-skeleton.md) — ein Lade-Form-Platzhalter
- [`ui-action`](../guides/actions-events.md) — das Ziel des CTA-Buttons
- [Bindings & State](../guides/bindings-state.md) — die State-/Store-Bindings
- Contract-Doc (intern, deutsch): `docs/nodes/feedback/ui-empty-state.md`
