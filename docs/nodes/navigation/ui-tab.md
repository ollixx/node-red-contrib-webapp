# `ui-tab`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-tab` ist ein **einzelner Tab** innerhalb eines [`ui-tabs`](ui-tabs.md)
(P168 / ADR 0018, Modell 1a). Es ist ein dünner **Container**, der die Metadaten
seines Abschnitts trägt (`label`, optional `icon`, `order`) und einen Default-
`content`-Slot für den Tab-Inhalt bereitstellt. **Die gemounteten Kinder
definieren die Tabs** — es gibt kein `tabs`-JSON-Feld auf dem `ui-tabs` mehr.

## Einordnung

- **Parent:** ein [`ui-tabs`](ui-tabs.md) — via `mount: ui-tabs:<tabsId>/content`. Der Mount-Picker liefert die äquivalente `container:<tabsId>/content`-Form. Der Mount **ist** die Deklaration des Tabs („Mounten in ein `ui-tabs` heißt: werde ein Tab").
- **Kinder:** beliebige View-Knoten, gemountet in den Default-`content`-Slot dieses Tabs (`mount: ui-tab:<tabId>/content`). Sie bilden das Panel des Tabs.
- **id = Tab-Schlüssel:** Die Knoten-id ist der Slot-Schlüssel des Tabs und das Token, das `activeTab` des Parents trägt. Die ids aller `ui-tab`-Kinder eines `ui-tabs` müssen **eindeutig** sein — ein Duplikat ist ein sichtbarer Deploy-Fehler.
- **Rolle zur Laufzeit:** `ui-tab` rendert **keine eigene Chrome** — der Parent `ui-tabs` zählt seine `ui-tab`-Kinder auf und rendert je Kind genau einen Tab (Nav-Eintrag) + ein Panel mit dem Inhalt dieses Tabs.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor. Default: fortlaufend `Tab N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Mount-Ziel: ein `ui-tabs`. In ein `ui-tabs` mounten macht diesen Knoten zu einem Tab. |

### Gruppe „Tab"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `label` | „Label" | typedInput (Binding) | optional | Der Tab-Titel. Voller kanonischer Wert-Bindungssatz (ADR 0012): `state`, `store`, `query`, `routeParam`, `literal` sowie Node-RED-Standard-Arten (`msg`, `flow`, `global`, `jsonata`, `env`). Default-Typ: `string`. Ohne Label wird die Knoten-id angezeigt. Ein bestehender `labelPath` (plain string) wird als `literal`-Binding übernommen. |
| `icon` | „Icon" | Textfeld | optional | Optionaler Icon-Name (`<sl-icon>`), der neben dem Label angezeigt wird. |

### Gruppe „Layout" (Child-Platzierung im Parent)

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Order" | Zahlenfeld | optional | Reihenfolge der Tabs innerhalb des `ui-tabs`. Das erste `ui-tab` nach `order` ist der Default-`activeTab`. Tabs ohne `order` werden nach geordneten Tabs einsortiert (Stabilität nach Deklarationsreihenfolge). |
| `row` / `col` / `colSize` / `rowSize` / `layoutX` / `layoutY` | — | Zahlenfelder | optional | Werden für `ui-tab` i. d. R. nicht genutzt (der Parent ordnet die Tabs); folgen dem Layout-Preset-Mechanismus. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-tab"`-Hilfetext soll knapp sein: Zweck (ein Tab eines
`ui-tabs`), Hinweis auf Mount („werde ein Tab"), `label`/`icon`/`order`,
Eindeutigkeit der id, Inhalt in den `content`-Slot, und ein Link auf die
ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/navigation/ui-tab.md`.

## Input / Output

`ui-tab` hat **keine** eigenen Input-/Output-Ports — es ist ein reiner
Struktur-/Container-Knoten. Der Tab-Wechsel und das `tabChange`/`change`-Event
liegen beim Parent [`ui-tabs`](ui-tabs.md).

## Theming

`ui-tab` rendert keine eigene Chrome; Aussehen und Variante der Tab-Leiste
steuert der Parent [`ui-tabs`](ui-tabs.md). Details:
[theming.md](../concepts/theming.md).

## Referenzen

- [ui-tabs.md](ui-tabs.md) — der Parent-Knoten (Tab-Leiste, `activeTab`, Events)
- [layout.md](../concepts/layout.md) — Child-Platzierungs-Felder
- [stores.md](../concepts/stores.md) — Binding-Arten für `label`
- [editor.md](../concepts/editor.md) — typedInput, Mount-Picker

## Offene Punkte

- Lazy-Loading von Tab-Inhalten (Panel erst rendern, wenn Tab erstmals betreten) ist noch nicht modelliert.
- Dynamische Tabs (ein `ui-repeat`, das `ui-tab`-Kinder emittiert) sind separat (P170 / ADR 0018 §2).
