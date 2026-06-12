# `ui-accordion-section`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-accordion-section` ist eine **einzelne Sektion** innerhalb eines
[`ui-accordion`](ui-accordion.md) (P169 / ADR 0018, Modell 1a). Es ist ein dünner
**Container**, der die Metadaten seines Abschnitts trägt (`label`, optional
`icon`, `order`) und einen Default-`content`-Slot für den Sektions-Inhalt
bereitstellt. **Die gemounteten Kinder definieren die Sektionen** — es gibt kein
`sections`-JSON-Feld auf dem `ui-accordion` mehr. Spiegelt
[`ui-tab`](ui-tab.md).

## Einordnung

- **Parent:** ein [`ui-accordion`](ui-accordion.md) — via `mount: ui-accordion:<accId>/content`. Der Mount-Picker liefert die äquivalente `container:<accId>/content`-Form. Der Mount **ist** die Deklaration der Sektion („Mounten in ein `ui-accordion` heißt: werde eine Sektion").
- **Kinder:** beliebige View-Knoten, gemountet in den Default-`content`-Slot dieser Sektion (`mount: ui-accordion-section:<sectionId>/content`). Sie bilden das aufklappbare Panel der Sektion.
- **id = Sektions-Schlüssel:** Die Knoten-id ist der Slot-Schlüssel der Sektion und das Token, das `openSection` des Parents trägt. Die ids aller `ui-accordion-section`-Kinder eines `ui-accordion` müssen **eindeutig** sein — ein Duplikat ist ein sichtbarer Deploy-Fehler.
- **Rolle zur Laufzeit:** `ui-accordion-section` rendert **keine eigene Chrome** — der Parent `ui-accordion` zählt seine Sektions-Kinder auf und rendert je Kind genau eine aufklappbare Sektion (`<sl-details>`) mit dem Inhalt dieser Sektion.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor. Default: fortlaufend `Section N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Mount-Ziel: ein `ui-accordion`. In ein `ui-accordion` mounten macht diesen Knoten zu einer Sektion. |

### Gruppe „Sektion"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `label` | „Label" | typedInput (Binding) | optional | Der Sektions-Titel (Summary). Voller kanonischer Wert-Bindungssatz (ADR 0012): `state`, `store`, `query`, `routeParam`, `literal` sowie Node-RED-Standard-Arten (`msg`, `flow`, `global`, `jsonata`, `env`). Default-Typ: `string`. Ohne Label wird die Knoten-id angezeigt. Ein bestehender `labelPath` (plain string) wird als `literal`-Binding übernommen. |
| `icon` | „Icon" | Textfeld | optional | Optionaler Icon-Name (`<sl-icon>`), der neben dem Label angezeigt wird. |

### Gruppe „Layout" (Child-Platzierung im Parent)

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Order" | Zahlenfeld | optional | Reihenfolge der Sektionen innerhalb des `ui-accordion`. Die erste Sektion nach `order` ist die Default-`openSection`. Sektionen ohne `order` werden nach geordneten Sektionen einsortiert (Stabilität nach Deklarationsreihenfolge). |
| `row` / `col` / `colSize` / `rowSize` / `layoutX` / `layoutY` | — | Zahlenfelder | optional | Werden für `ui-accordion-section` i. d. R. nicht genutzt (der Parent ordnet die Sektionen); folgen dem Layout-Preset-Mechanismus. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-accordion-section"`-Hilfetext soll knapp sein: Zweck (eine
Sektion eines `ui-accordion`), Hinweis auf Mount („werde eine Sektion"),
`label`/`icon`/`order`, Eindeutigkeit der id, Inhalt in den `content`-Slot, und
ein Link auf die ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/navigation/ui-accordion-section.md`.

## Input / Output

`ui-accordion-section` hat **keine** eigenen Input-/Output-Ports — es ist ein
reiner Struktur-/Container-Knoten. Der Sektions-Wechsel und das
`sectionOpen`/`sectionClose`-Event liegen beim Parent
[`ui-accordion`](ui-accordion.md).

## Theming

`ui-accordion-section` rendert keine eigene Chrome; Aussehen der Sektions-Leiste
steuert der Parent [`ui-accordion`](ui-accordion.md). Details:
[theming.md](../concepts/theming.md).

## Referenzen

- [ui-accordion.md](ui-accordion.md) — der Parent-Knoten (Sektions-Container, `openSection`, Events)
- [layout.md](../concepts/layout.md) — Child-Platzierungs-Felder
- [stores.md](../concepts/stores.md) — Binding-Arten für `label`
- [editor.md](../concepts/editor.md) — typedInput, Mount-Picker

## Offene Punkte

- Lazy-Loading von Sektions-Inhalten (Panel erst rendern, wenn Sektion erstmals geöffnet) ist noch nicht modelliert.
- Dynamische Sektionen (ein `ui-repeat`, das `ui-accordion-section`-Kinder emittiert) sind separat (P170 / ADR 0018 §2).
