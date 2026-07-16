# Testkatalog: ui-list

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit dem Epic `nodes/ui-list`
> (Angleichung an die geglättete Spec). Bestehende E2E:
> `tests/e2e/nodes/composite/ui-list.spec.ts`.

## Geplante Testziele

### items-typedInput + Item-Schema (P171)

- `items`-typedInput (Wert-Bindings) ersetzt `itemsPath`; `items:null`-Default weg.
- **Typ-Einschränkung:** `str`/`num`/`bool` im typedInput nicht anwählbar; `json`
  (Array) + state/store/query/routeParam/msg/flow/global/jsonata/env vorhanden.
- Migration: gespeichertes `itemsPath` (string) → `state`-Binding auf `items`;
  Altflow rendert unverändert.
- **Array-of-Strings:** `["A","B"]` → `[{label:"A"},{label:"B"}]`; gemischtes Array
  (String + Objekt) rendert.
- Item-Schema `{id?,label,value?,icon?}`: `label` Pflicht rendert; fehlendes
  `label` (Objektform) → `"?"` nur für diese Zeile; Nicht-Array-Wurzel → leere
  Liste (null `li.webapp-list-item`); Zusatzfelder ignoriert.
- **value/displayValue:** Default `none` → `value` nicht sichtbar, aber im Event;
  `secondary` → trailing Text; `badge` → Badge in `badgeVariant`-Farbe
  (Variant-SelectBox, `SEVERITY_VARIANTS`; Feld nur bei `badge` sichtbar). `value`
  (String|Number) stets in `row.value`.
- `itemClick`-Event → Output-Port; `params {rowId,row}` + clientId/sourceId/appId;
  `rowId` = `id` (sonst Index), `row` = ganzes Element inkl. `value`.
- Hilfetext nennt Item-Schema + String-Kurzform + value/displayValue + Doku-Link.

### Single-Select (P173)

- `selectable` (Default false) schaltet Single-Select; Klick markiert die Zeile.
- `selectedId` (zweiseitig): externe Store-Änderung markiert die Zeile (SSE);
  Klick auf andere Zeile schreibt den Store; ungültige id → keine Markierung.
- `itemSelect` feuert nur bei `selectable` + Auswahlwechsel; `params {rowId,row}`
  + clientId/sourceId/appId; ohne `selectable` wirkungslos.

Umgesetzt in `tests/e2e/nodes/view/ui-list.spec.ts` (`describe` „single-select (P173)"):

- **S01** `selectable` aus → kein `aria-selected`, keine `webapp-list-item--selected`-Klasse.
- **S02** `selectable` an + `selectedId`-State-Binding markiert die passende Zeile (Read).
- **S03** externe Store-Änderung → SSE-Re-Render verschiebt die Markierung.
- **S04** Zwei-Wege-Roundtrip: Klick → `itemSelect` → verdrahtetes `ui-store set` →
  Zeile wird via `selectedId` markiert.
- **S05** `itemSelect` feuert nur bei `selectable` + Auswahlwechsel; Payload
  `{rowId,row}` + `sourceId`.
- **S06** `selectable` aus → Klick emittiert nur `itemClick`, nie `itemSelect`;
  kein `data-webapp-selectable`.

Ergänzende Renderer-Unit-Coverage: `packages/runtime/test/p173-list-single-select-behaviour.test.ts`
(mapConfig-Pass-through/Migration + Selected-State-Markierung inkl. Index-Fallback-`rowId`).

### Item-Feld-Mapping (P208)

`labelField`/`valueField`/`idField`/`iconField` bestimmen, **welches Feld einer
rohen Entity** Label/Value/Id/Icon einer Zeile ist. Absent ⇒ Defaults
`label`/`value`/`id`/`icon` (rückwärtskompatibel, flache Feldnamen). Der
Serializer liest `row[labelField]`/`row[idField]`/`row[valueField]`/
`row[iconField]`; `items` bleibt roh und `itemClick.row` trägt die **volle**
Entity. `idField` speist konsistent `rowId` (itemClick), `selectedId`-Markierung
und den `itemSelect`-Roundtrip.

Unit-Coverage: `packages/schema/test/schema.test.ts` (P208 — Defaults gesetzt
wenn absent; explizite Werte übernommen).

Umgesetzt in `tests/e2e/nodes/view/ui-list.spec.ts` (`describe` „item-field mapping (P208)"):

- **FM01** `labelField='name'` + `idField='_id'` auf rohen Entities
  `[{_id:'e1',name:'Alpha'},{_id:'e2',name:'Bravo'}]` → Zeilen-Labels rendern
  **gemessen** als „Alpha"/„Bravo" (DOM-Text, kein „?").
- **FM02** `itemClick` → `params.rowId = 'e1'` (aus `idField`) und `params.row`
  = die **volle** rohe Entity `{_id:'e1',name:'Alpha'}` (unverändert).
- **FM03** `selectable` + `idField='_id'`: `selectedId='e2'` markiert die
  passende rohe-Entity-Zeile (Bravo) — idField-Konsistenz mit der Markierung.
- **FM04** Rückwärtskompatibel: geformte Items `{id,label}` **ohne** gesetzte
  *Field-Optionen rendern unverändert (Defaults greifen); `rowId` kommt weiter
  aus dem Default-`id`-Feld.

### Basis-Felder (P172, ADR 0015)

- „Allgemein"-Gruppe injiziert (idempotent).
- `visible` anwendbar; `disabled` anwendbar (Zeilen-Interaktion); `color`
  anwendbar (non-variant, Literal-Roundtrip); `size` N/A (Hinweis: `displayType`
  steuert die Dichte).

### Per-Item-Icon (P176)

Das Item-Schema `{id?,label,value?,icon?}` verspricht ein führendes `icon`.
`icon` ist ein backend-neutraler Icon-Wert (bare Name gegen die Shoelace-
Default-Library ODER `{library?,name}`), gerendert als führendes
`<sl-icon class="webapp-list-item-icon …">` vor dem Label — in interaktiven
UND nicht-interaktiven Zeilen; fehlendes `icon` → kein Icon-Element (unverändert);
String-Kurzform (Item ist ein String) → kein Icon.

Umgesetzt in `tests/e2e/nodes/view/ui-list.spec.ts` (`describe` „per-item icon (P176)"):

- **I01** Nicht-interaktiv: Item mit bare-String-Icon `"star"` → `<sl-icon
  class="webapp-list-item-icon" name="star">`; Item ohne Icon → kein Icon.
- **I02** Interaktiv (itemClick): Icon als führendes Kind im `<a>`; ohne Icon → kein Icon.
- **I03** Objekt-Form `{name:"bell"}` rendert; String-Kurzform hat kein Icon und kein Crash.
- **I04** Icon + value (badge) koexistieren: Icon führt, Badge folgt dem Label.

### Visuelles Design + color-Auflösung (P183)

Unit-Coverage: `packages/runtime/test/p183-list-visual-design-and-color.test.ts`
(37 Tests — resolveColorValue · displayType-CSS-Klassen · Zeilen-Anatomie · color-Basis-Feld).

**resolveColorValue (Serializer-Helfer, exportiert):**
- Semantische Tokens `primary/success/warning/danger/neutral/info` → `var(--wa-color-*)`.
- `info` → `var(--wa-color-primary)` (kein separates `--wa-color-info`-Token).
- Token-Matching case-insensitive.
- `#hex`, `rgb()`, `rgba()`, `hsl()`, `var()` → unveränderter CSS-Wert.
- Bekannte CSS-Farb-Keywords (`red`, `transparent`, …) → unveränderter CSS-Wert.
- Unbekannter Bezeichner (z. B. `banana`, `myBrand`) → `undefined` (kein `style`-Attribut).
- `""`, `undefined`, `null` → `undefined`.

**displayType-CSS-Klassen im generierten HTML:**
- `plain` / absent → `class="webapp-list"`, keine Modifier-Klasse.
- Migration: alter Wert `default` oder `compact` → wie `plain`.
- `divided` → `webapp-list--divided`.
- `grouped` → `webapp-list--grouped`.
- `actionable` → `webapp-list--actionable`.

**Zeilen-Anatomie:**
- Jede Zeile hat `webapp-list-item`-Klasse.
- Icon → `webapp-list-item-icon`-Klasse auf dem `<sl-icon>`; Items ohne Icon → kein `<sl-icon>`.
- String-Kurzform-Items → kein Icon.
- `displayValue=secondary` → `<span class="webapp-list-value">…</span>` mit Abstand (kein „Eins1"-Kleben).
- `displayValue=badge` → `<sl-badge class="webapp-list-value" …>`, kein Kleben.
- `displayValue=none` → kein `class="webapp-list-value"`-Element im HTML.

**color-Basis-Feld (P172/P183):**
- `color='primary'` → `style` enthält `var(--wa-color-primary)`.
- `color='success'` → `style` enthält `var(--wa-color-success)`.
- `color='#ff0000'` → `style` enthält `color:#ff0000`.
- `color='banana'` (unbekannt) → kein `style="color:"` emittiert.
- `color` absent → kein `style="color:"` emittiert.

E2E (`verify: browser`) wird im Haupt-Checkout durch den Orchestrator durchgeführt
([[orchestrator-must-verify-e2e-in-main-checkout]]).

## Showcase-Spec (P187, ADR 0022 §2)

Pilot-Showcase-Spec: `tests/e2e/showcase/ui-list.showcase.spec.ts`

Abgedeckte Features in benannten `test.step`-Kapiteln (→ Kapitel im Trace/Video):
1. String-Items → beschriftete Zeilen.
2. `displayType=divided` → Separator-CSS-Klasse.
3. `displayType=grouped` → Grouped-CSS-Klasse.
4. `displayType=actionable` + `itemClick`-Event (mit `params.rowId`-Assertion).
5. `displayValue=secondary` → trailing `<span class="webapp-list-value">`.
6. `displayValue=badge` → `<sl-badge class="webapp-list-value" variant="…">`.
7. Per-Item-Icon → führendes `<sl-icon class="webapp-list-item-icon">`.
8. `selectable=true` + `selectedId`-State-Binding → markierte Zeile.
9. Config-Dialog-Cameo: `#node-input-items` im Editor-Tray sichtbar.

Laufbar unter `SHOWCASE=1 pnpm exec playwright test tests/e2e/showcase/ui-list.showcase.spec.ts`.
