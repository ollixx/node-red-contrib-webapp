# `ui-input`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-input` rendert ein einzeiliges Texteingabefeld und bindet seinen Wert
bidirektional an den Client-State. Drei Eingabe-Typen stehen zur Wahl
(`text`, `email`, `number`). Die **Lese-Hälfte** ist das `value`-Binding
(Anzeige/Initialwert, voller Binding-Satz); die **Schreib-Hälfte** ist das
`writeTo`-Binding (ADR 0027) — das Ziel, in das die Runtime die Nutzeränderung
beim `writeTrigger`-Event persistiert. Zusätzlich emittiert der Knoten bei jeder
Änderung und bei Bestätigung (Enter/Submit) ein Event auf seinem Output-Port
(der Write-Back ist **additiv**, ersetzt die Events nicht).

## Einordnung

- **Parent:** ein Slot einer `ui-app`, `ui-route`, `ui-dialog` oder
  `ui-container` — angegeben über `mount` (Mount-Pfad) oder `parent` (Node-ID).
- **Kinder:** keine.
- **Erreichbarkeit:** im gerenderten Layout an der Position, die `mount`/`parent`
  und die Layout-Child-Felder (`order`, `row`/`col`, `layoutX`/`layoutY`)
  vorgeben.
- **Rolle zur Laufzeit:** liest `value` aus dem Client-State; schreibt die
  Nutzeränderung beim `writeTrigger`-Event in das `writeTo`-Ziel zurück
  (Store per-client mit SSE-Re-Render, Flow/Global server-seitig). Gibt
  zusätzlich `change`- und `submit`-Events auf dem Output-Port aus.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Input N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Hierarchischer Slot-Picker (Route/Dialog → Container → Slot). Bestimmt den Einbauort im Layout. Siehe [layout.md](../concepts/layout.md). |

### Gruppe „Inhalt"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `label` | „Label" | Textfeld | **ja** | Beschriftung des Eingabefeldes. Wird als Feld-Label über dem Input angezeigt. |
| `value` | „Value" | typedInput (alle Binding-Arten) | **ja** | Bindbare **Lese**-Quelle des Feldwerts (Anzeige/Initialwert). Unterstützt alle Binding-Arten: `literal`, `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env`. Details: [stores.md](../concepts/stores.md). |
| `writeTo` | „Write To" | typedInput (**nur schreibbare** Arten: Store/Flow/Global) | optional | Bindbares **Schreib**-Ziel (ADR 0027). Nur die schreibbaren Kinds sind zulässig: `store` (ein `ui-store` + optionaler ein-Ebenen-Sub-Pfad), `flow`, `global`. Nicht-schreibbare Kinds (query, routeParam, reactive, literal, msg, jsonata, env) sind ausgeschlossen. Die Runtime schreibt die Nutzeränderung beim `writeTrigger` in dieses Ziel. |
| `writeTrigger` | „Write Trigger" | SelectBox (`none` / `change` / `submit`) | optional | Wann geschrieben wird: `submit` (Default) = bei Enter/Blur, `change` = bei jeder Eingabe, `none` = **kein** automatischer Write-Back (P206) — der Flow-Autor verdrahtet die Persistenz selbst (`change → function → ui-store`); `writeTo` darf bei `none` leer sein. Die `change`/`submit`-Output-Events feuern in allen Fällen unverändert. |
| `inputType` | „Input Type" | SelectBox (`text` / `email` / `number`) | **ja** | Semantischer Eingabe-Typ. Steuert Tastatur-Typ und Browser-Validierung. Default: `text`. |
| `placeholder` | „Placeholder" | Textfeld | optional | Platzhaltertext, der angezeigt wird, wenn das Feld leer ist. |
| `variant` | „Variant" | SelectBox (Variant) | optional | Visuelle Feld-Rolle (`default`, `filled`, `outlined`). Default: `default`. Vocabulary: [theming.md](../concepts/theming.md). |
| `size` | „Größe" | SelectBox (`small` / `medium` / `large`) | optional | Größe des Eingabefeldes. Default: `medium`. |
| `disabled` | „Disabled" | typedInput (alle Binding-Arten) | optional | Bindbare Bedingung, die das Feld deaktiviert (Nutzereingabe gesperrt). |

### Entfernte Felder (migriert, ADR 0027)

| Feld (alt) | Status | Migration |
|---|---|---|
| `storeId` | **entfernt** | Ein Alt-Knoten mit `storeId`+`path` wird beim Öffnen im Editor verlustfrei nach `writeTo = {kind:"store", path:<storeId>, subPath:{kind:"literal", value:<path>}}` migriert. Beim Speichern werden die Alt-Felder nicht mehr erzeugt. Die Runtime führt dieselbe Migration für alt-deployte Configs durch. |
| `path` | **entfernt** | Siehe `storeId` — wird zum `subPath` des migrierten `writeTo`. |
| `valuePath` | **entfernt** | Legacy Pre-P123-State-Pfad → wird zu `value = {kind:"state", path:<valuePath>}` migriert. |

> **Wichtig:** Die alten `storeId`/`path`-Felder schrieben **nie** tatsächlich
> zurück (verifiziert 2026-07-05, ADR 0027). Der echte Write-Back läuft jetzt
> über `writeTo` + `writeTrigger`.

### Gruppe „Platzierung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Order" | Zahlfeld | optional | Reihenfolge im Parent-Slot (horizontal/vertical Layout). |
| `row` / `col` | „Row" / „Col" | Zahlfeld (≥ 1) | optional | Startposition im Grid-Layout (1-basiert). |
| `colSize` / `rowSize` | „Col Span" / „Row Span" | Zahlfeld (≥ 1) | optional | Spalten-/Zeilenspanne im Grid-Layout. |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlfeld | optional | Pixelkoordinaten im Absolute-Layout. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-input"`-Hilfetext soll knapp sein: Zweck (einzeiliges
Eingabefeld), Hinweis auf `value`-Binding (Lesen) und `writeTo` + `writeTrigger`
(Schreiben, Store/Flow/Global), `change`- und `submit`-Events und ein Link auf die
ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/input/ui-input.md`.

## Input

`ui-input` hat einen **Eingangs-Port**, über den der Flow den Feldwert und den
Komponentenzustand steuert.

- **`msg.payload`** (nicht-null) → aktualisiert das `value`-Feld des Knotens und
  sendet einen frischen Snapshot an alle verbundenen Clients der App. Nutzbar z. B.
  aus einem `inject`-Knoten heraus, um das Feld vorzubefüllen.
- **`msg.ui.patch`** → überschreibt beliebige Felder der Knoten-Definition (z. B.
  `placeholder`, `disabled`, `inputType`). Binding-behaftete Felder (`value`)
  müssen als Binding-Objekt übergeben werden. Details: [inputs.md](../concepts/inputs.md).
- **`msg.ui.component.op`** → Komponentenoperation:
  - `show` / `hide` — Sichtbarkeit umschalten
  - `enable` / `disable` — Eingabe freigeben / sperren
  - `focus` — Fokus auf das Feld setzen
  - `reset` — Feldwert auf den konfigurierten Initialwert zurücksetzen
- **Nicht erkannte / fachfremde Messages** → werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-input` hat einen **Ausgangs-Port**. Emittiert wird bei Nutzerinteraktion:

| Event | Wann | `msg.ui.params` | Intention |
|---|---|---|---|
| `change` | Nutzereingabe (jede Änderung des Feldwerts) | `value` — der neue Feldwert | Validierung, Live-Suche, Store-Update |
| `submit` | Enter / Submit-Auslösung | `value` — der bestätigte Feldwert | Formular absenden, Suchanfrage starten |

Gemeinsame `msg.ui`-Felder beider Events: `appId`, `clientId`, `event`, `sourceId`.

Für das reine „Feld in einen Store schreiben" ist **keine** Verdrahtung mehr
nötig — dafür ist `writeTo` da. Die Events bleiben für zusätzliche Seiteneffekte:

**Antizipierte Wiring-Szenarien:**
- `change` → `function` → Validierung (zusätzlich zum `writeTo`-Store-Update).
- `submit` → `http request` → API-Aufruf mit dem eingegebenen Wert.
- `submit` → `ui-action` (`navigate`) → Weiterleitung nach erfolgreichem Speichern.

## Theming

`ui-input` trägt ein echtes Ebene-2-`variant`-Feld (`default`, `filled`,
`outlined`) — ausgewählt über die Variant-SelectBox, gespeist aus
`INPUT_VARIANTS` (`packages/schema/src/contracts.ts`). Das Renderer-Backend
bildet die Variante auf die entsprechende visuelle Darstellung ab; unbekannte
Varianten werden auf `default` zurückgefallen. Details: [theming.md](../concepts/theming.md).

## Besonderheiten

- **Two-Way ohne Verdrahtung.** `value = store(x).name` (Lesen) **und**
  `writeTo = store(x).name` (Schreiben) machen dasselbe Store-Slice les- und
  schreibbar: Tippen + Trigger aktualisiert den Store, jeder an `store(x).name`
  gebundene View re-rendert live (SSE) — **kein** `function`-Knoten nötig.
- **Schreibbare Kinds nur.** `writeTo` akzeptiert ausschließlich `store`, `flow`
  und `global`. Das Schema (`writeToBindingSchema`) lehnt nicht-schreibbare Kinds
  (query/routeParam/reactive/literal/msg/jsonata/env) ab — man kann nicht in eine
  berechnete Quelle zurückschreiben.
- **Store vs. Flow/Global.** Ein `store`-Ziel wird als per-client `op:set`
  (statePath + subPath, mit clientId) angewandt und löst einen SSE-Re-Render aus.
  `flow`/`global` schreiben server-seitig in den Node-RED-Kontext — bewusst **ohne**
  per-client-Scope und **ohne** automatischen Re-Render (dokumentierte Grenze).
- **Write-Back ist additiv.** Der bestehende `change`/`submit`-Output-Event feuert
  unverändert weiter; der Write-Back läuft zusätzlich.

## Referenzen

- [layout.md](../concepts/layout.md) — Platzierungsfelder und Presets
- [stores.md](../concepts/stores.md) — Binding-Arten und Store-Operationen
- [inputs.md](../concepts/inputs.md) — `msg.payload`- und `msg.ui.patch`-Protokoll
- [events.md](../concepts/events.md) — Event-Format und Output-Ports
- [theming.md](../concepts/theming.md) — Variant-Vokabular
- [`ui-store`](../state/ui-store.md) — Store-Knoten (Ziel eines `writeTo=store`)
- [`ui-container`](../display/ui-container.md) — möglicher Parent
- [ADR 0027](../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md) — `value` liest, `writeTo` schreibt

## Offene Punkte

- Clientseitige Validierungsregeln (Required, Pattern, Min/Max für number) sind noch nicht modelliert.
- Ein `writeTo=store` mit dynamischem (nicht-literalem) `subPath` wird beim
  Write-Back noch nicht aufgelöst (nur ein literaler Sub-Pfad ist ein stabiler
  Schreib-Schlüssel).
