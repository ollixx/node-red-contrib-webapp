# ui-accordion-section

Eine einzelne Sektion innerhalb eines [`ui-accordion`](ui-accordion.md) — ein
dünner Container für Titel und Inhalt einer Sektion.

> English (canonical): [nodes/ui-accordion-section.md](../../nodes/ui-accordion-section.md)

## Zweck

`ui-accordion-section` ist eine **Sektion** eines
[`ui-accordion`](ui-accordion.md). Es trägt das `label` (Summary) und optional
`icon` der Sektion und stellt einen `content`-Slot für das aufklappbare Panel
bereit. **Die gemounteten Kinder definieren die Sektionen** — eine Sektion in ein
`ui-accordion` zu mounten *ist* die Sektions-Deklaration; es gibt kein
Sections-JSON-Feld. Es rendert keine eigene Chrome — der Parent rendert die
`<sl-details>`-Summary und das Panel. Spiegelt [`ui-tab`](ui-tab.md).

## Wann einsetzen

- Eine Sektion zu einem [`ui-accordion`](ui-accordion.md) hinzufügen: einen
  `ui-accordion-section` anlegen, in das Accordion mounten und den Sektions-Inhalt
  in den `content`-Slot dieses Knotens mounten.
- Für datengetriebene Sektionen eine einzelne Sektion in ein
  [`ui-repeat`](ui-repeat.md) hüllen (eine Sektion je Zeile).

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `Section N` |
| **Parent Slot** (`mount`) | Mount-Ziel: ein `ui-accordion`. In es mounten macht diesen Knoten zu einer Sektion. Pflicht. | Mount-Pfad | — |
| **Label** (`label`) | Der Sektions-Titel/Summary (bindbar). Ohne Label wird die Knoten-ID gezeigt. | `state`, `store`, `query`, `routeParam`, `literal`, `msg`, `flow`, `global`, `jsonata`, `env` (Default-Typ `string`) | Knoten-ID |
| **Icon** (`icon`) | Optionaler Icon-Name (`<sl-icon>`) neben dem Label. | Freitext | — |

Die Basis-Felder (`visible`/`disabled`/`color`/`size`/`variant`) sind **N/A** —
eine Sektion rendert keine eigene Chrome; ihr Offen-/Zu-Zustand steuert die
`openSection` des Parents. Die Knoten-ID ist der Sektions-Schlüssel (der
`openSection`-Wert) und muss innerhalb eines `ui-accordion` eindeutig sein.

## Eingang

`ui-accordion-section` hat **keinen Eingangs-Port** — es ist ein reiner Struktur-/
Container-Knoten. Der Sektions-Wechsel und die
`sectionOpen`/`sectionClose`-Events liegen beim Parent
[`ui-accordion`](ui-accordion.md).

## Ausgänge / Events

Keine — `ui-accordion-section` hat keinen Output-Port.

## Beispiele

Das Sektions-Beispiel liegt beim Parent: drei Sektions-Kinder bilden ein
Einzel-Modus-FAQ, jedes mit eigenem Antwort-Panel.

Flow-Datei: [`examples/guide/ui-accordion.json`](../../../../examples/guide/ui-accordion.json)
(siehe [`ui-accordion`](ui-accordion.md) für Import-Anleitung und das zweiseitige
Write-back).

## Verwandt

- [`ui-accordion`](ui-accordion.md) — der Parent (`openSection`, `multiple`, Events)
- [`ui-tab`](ui-tab.md) — das spiegelbildliche Kind für [`ui-tabs`](ui-tabs.md)
- [`ui-repeat`](ui-repeat.md) — datengetriebene Sektionen (eine Sektion je Zeile)
- Contract-Doc (intern, deutsch): `docs/nodes/navigation/ui-accordion-section.md`
