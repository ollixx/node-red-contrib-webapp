# ui-tab

Ein einzelner Tab innerhalb eines [`ui-tabs`](ui-tabs.md) — ein dünner Container
für Titel und Inhalt eines Tabs.

> English (canonical): [nodes/ui-tab.md](../../nodes/ui-tab.md)

## Zweck

`ui-tab` ist ein **Tab** einer [`ui-tabs`](ui-tabs.md)-Leiste. Es trägt das
`label` des Tabs (und optional `icon`) und stellt einen `content`-Slot für das
Panel bereit. **Die gemounteten Kinder definieren die Tabs** — einen `ui-tab` in
ein `ui-tabs` zu mounten *ist* die Tab-Deklaration; es gibt kein Tabs-JSON-Feld.
`ui-tab` rendert keine eigene Chrome — der Parent `ui-tabs` rendert Nav-Eintrag
und Panel.

## Wann einsetzen

- Einen Tab zu einem [`ui-tabs`](ui-tabs.md) hinzufügen: einen `ui-tab` anlegen,
  in das `ui-tabs` mounten und den Tab-Inhalt in den `content`-Slot dieses Knotens
  mounten.
- Für datengetriebene Tabs einen einzelnen `ui-tab` in ein
  [`ui-repeat`](ui-repeat.md) hüllen (ein Tab je Zeile).

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `Tab N` |
| **Parent Slot** (`mount`) | Mount-Ziel: ein `ui-tabs`. In es mounten macht diesen Knoten zu einem Tab. Pflicht. | Mount-Pfad | — |
| **Label** (`label`) | Der Tab-Titel (bindbar). Ohne Label wird die Knoten-ID gezeigt. | `state`, `store`, `query`, `routeParam`, `literal`, `msg`, `flow`, `global`, `jsonata`, `env` (Default-Typ `string`) | Knoten-ID |
| **Icon** (`icon`) | Optionaler Icon-Name (`<sl-icon>`) neben dem Label. | Freitext | — |

Die Basis-Felder (`visible`/`disabled`/`color`/`size`/`variant`) sind **N/A** — ein
Tab rendert keine eigene Chrome; die Sichtbarkeit eines Tabs steuert die
`activeTab`-Auswahl des Parents. Die Knoten-ID ist der Tab-Schlüssel (der
`activeTab`-Wert) und muss innerhalb eines `ui-tabs` eindeutig sein.

## Eingang

`ui-tab` hat **keinen Eingangs-Port** — es ist ein reiner Struktur-/Container-
Knoten. Der Tab-Wechsel und das `tabChange`-Event liegen beim Parent
[`ui-tabs`](ui-tabs.md).

## Ausgänge / Events

Keine — `ui-tab` hat keinen Output-Port.

## Beispiele

Das Tab-Beispiel liegt beim Parent: zwei `ui-tab`-Kinder definieren eine
Overview/Details-Tab-Leiste, jedes mit eigenem Panel-Inhalt.

Flow-Datei: [`examples/guide/ui-tabs.json`](../../../../examples/guide/ui-tabs.json)
(siehe [`ui-tabs`](ui-tabs.md) für Import-Anleitung und das zweiseitige Write-back).

## Verwandt

- [`ui-tabs`](ui-tabs.md) — die Parent-Tab-Leiste (`activeTab`, Events)
- [`ui-repeat`](ui-repeat.md) — datengetriebene Tabs (ein `ui-tab` je Zeile)
- Contract-Doc (intern, deutsch): `docs/nodes/navigation/ui-tab.md`
