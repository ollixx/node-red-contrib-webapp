# Testkatalog: ui-tabs / ui-tab

> Format gemäß `.ai/agents/node-testing.md`. Neu geschrieben mit P168 (ADR 0018,
> Modell 1a — Kinder definieren die Tabs).

Spec: `tests/e2e/nodes/view/ui-tabs.spec.ts`
Unit: `packages/runtime/test/p155-tabs-activetab-typedinput.test.ts`,
`packages/runtime/test/p168-tabs-children-model.test.ts`
Editor-Regression: `tests/e2e/nodes/editor/navigation-nodes.spec.ts`,
`tests/e2e/nodes/editor/minimal-coverage.spec.ts`

## Zielmodell (P168, ADR 0018)
- **Kein `tabs`-JSON-Feld mehr.** Die Tabs werden aus den gemounteten
  `ui-tab`-Kindern abgeleitet — ein Panel je Kind, Slot-Schlüssel = Kind-id.
- `ui-tab` ist ein dünner Container (`label`/`icon`/`order` + Default-`content`-Slot).
  Mount in ein `ui-tabs` (`ui-tabs:<id>/content`, Picker-Alias `container:<id>/content`)
  = „werde ein Tab". Inhalt mountet in `ui-tab:<tabId>/content`.
- `activeTab` (P155/ADR 0012, **zweiseitig**) trägt die **Kind-id**; Default =
  erstes Kind nach `order`; ungültiger Wert → erstes Kind.
- Eindeutigkeit: doppelte `ui-tab`-id unter einem `ui-tabs` → sichtbarer Deploy-Fehler.
- Migration: Legacy `tabs:[{id,label}]` + `tab:<id>`-Mounts → `ui-tab`-Kinder +
  `ui-tab:<id>/content`-Mounts (verlustfrei, einmalig beim Deploy).

## E2E-Tests (`ui-tabs.spec.ts`)
| ID | Ziel |
|---|---|
| R01 | Zwei `ui-tab`-Kinder rendern als `sl-tab`/`sl-tab-panel`-Paare. |
| R02 | Inhalt jedes Tabs rendert in sein eigenes Panel; Tab-Wechsel zeigt es. |
| A01 | `activeTab` Literal-Binding markiert den passenden `sl-tab` aktiv. |
| A02 | `activeTab` State-Binding löst den aktiven Tab aus dem Store auf. |
| A03 | `activeTab` **zweiseitig**: Tab-Klick → change-Event → verdrahteter Store-`set` → SSE-Re-Render aktiviert den gewählten Tab (Browser-Beweis-Roundtrip). |
| A04 | Externe Store-Änderung → SSE-Re-Render aktiviert den Tab. |
| D01 | Ohne `activeTab` → erstes Kind nach `order` ist aktiv. |
| E01 | `change`: `sl-tab-show` emittiert `change` mit `params.value` (Kind-id). |
| V01 | `variant` (Nicht-Farb-Appearance, P250): jeder Wert `line`/`contained`/`pills` emittiert **gemessen** `data-variant="<wert>"` am `sl-tab-group`; fehlender Wert → Default `data-variant="line"`. Kein `mapVariant` (Farb-Tabelle nur button/badge/alert/toast); Emit wie `ui-avatar` (P94). |
| M01 | Legacy `tabs`-JSON-Flow migriert: Tabs + Inhalt rendern weiterhin. |

## Unit-Tests
`p155-tabs-activetab-typedinput.test.ts`:
- Kanonisches `activeTab`-Binding-Objekt (state/store/literal) → `activeTab`.
- Legacy `activeTabPath` → State-Binding (Migration); kanonisch gewinnt.
- Ohne `activeTab`/`activeTabPath` bleibt `activeTab` `undefined`.
- `tabChange`-Event bleibt neben dem `activeTab`-Binding erhalten.
- Read-Resolution (Compile→Render→Serialize): Literal/State/Legacy-Pfad markieren
  den richtigen `sl-tab` aktiv; ohne Wert → erstes Kind; je Kind ein Panel mit Inhalt.

`p168-tabs-children-model.test.ts`:
- Ein `sl-tab` + `sl-tab-panel` je `ui-tab`-Kind; Inhalt im Panel.
- activeTab markiert das Kind; ungültiger Wert → erstes Kind (Fallback).
- `container:<id>/content`-Mount-Alias des Pickers wird akzeptiert.
- Migration (`migrateLegacyTabComponents`): synthetisiert `ui-tab`-Kinder,
  hängt `tab:<id>`-Inhalts-Mounts um, lässt Kinder-Modell unverändert, rendert E2E.
- Eindeutigkeit (`validateUiTabChildrenUniqueness`): doppelte id pro `ui-tabs` →
  ein Issue je Knoten; gleiche id unter verschiedenen `ui-tabs` ist erlaubt.

## Editor-Regression
- `minimal-coverage.spec.ts`: ui-tabs `fields:["name","mount"]`, `inputs:1`;
  ui-tab `fields:["name","mount"]`.
- `navigation-nodes.spec.ts`: ui-tabs hat **kein** `tabs`-Feld mehr; 1 Output-Port.

## Dynamische Tabs via ui-repeat (P170, ADR 0017 × 0018) — abgedeckt

> Kapstein der Tabs-1a-Welle: der **dynamische** Fall ist **kein** eigener
> Mechanismus, sondern die Komposition aus `ui-repeat` (ADR 0017) und
> Kinder-definieren-Tabs (ADR 0018). Ein `ui-repeat` (Schablone = ein einzelnes
> `ui-tab`, `label = item.<feld>`), in ein `ui-tabs` gemountet, rendert N Tabs —
> einen je Datenzeile.
>
> - Renderer-Unit: `packages/renderer/test/p170-dynamic-tabs-sections.test.ts`
>   (Komposition + Keying/Stabilität via `replaceState`).
> - Voller Pipeline-Render (HTML): `packages/runtime/test/p170-dynamic-tabs-sections.test.ts`.
> - Browser-Beweis: `tests/e2e/nodes/view/dynamic-tabs-sections.spec.ts`
>   (T01 N Tabs aus Store-Array + Inhalt je Item-Scope; T02 Hinzufügen keyed;
>   T03 Umsortieren keyed, Ids stabil).

- **Komposition statt Mechanismus:** `renderTabs` zählt die Tab-Kinder über
  `resolveSectionChildren` auf — ein direkt gemountetes `ui-tab` ist eine
  statische Sektion, ein gemountetes `ui-repeat` wird (mit `expandRepeat`-Frames
  und Per-Instanz-Key) je Item in genau ein keyed `ui-tab` expandiert. Statische
  und dynamische Tabs koexistieren unter einem `ui-tabs`.
- **Keying/Stabilität:** Tab-Id = `<itemKey>#<templateId>` (Repeat-Key × Tab-Id);
  Hinzufügen/Löschen/Umsortieren des Arrays formt die sichtbare Tab-Menge um, die
  unveränderten Tabs behalten ihre Id (kein Re-Mount); `activeTab` bleibt gültig,
  solange seine Zeile existiert, und fällt sonst auf das erste Kind zurück.
- **Label/Inhalt im Item-Scope:** das Tab-`label` und der Panel-Inhalt lösen gegen
  den `{item,index}`-Frame der jeweiligen Zeile auf (`item.<feld>`).

### Store-gebundenes Tab-Label (v1.0.1 Regressions-Coverage)

- **L01** store-gebundenes `label` löst zum Store-Wert auf (Content ebenso).
- **L02** store-gebundenes `label` aktualisiert bei SSE-Store-Änderung.
- **L03** store-gebundenes `label` löst auf, wenn der Store erst zur Laufzeit gefüllt wird (kein `initialValue`).

(Der gemeldete Bug „Label löst nicht auf" reproduzierte auf aktuellem Code NICHT — vermutlich stale `packages/*/dist` in der laufenden Instanz. Diese Tests sperren das korrekte Verhalten ein.)
