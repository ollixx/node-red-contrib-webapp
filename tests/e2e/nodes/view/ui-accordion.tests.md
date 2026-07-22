# Testkatalog: ui-accordion / ui-accordion-section

> Format gemäß `.ai/agents/node-testing.md`. Neu geschrieben mit P169 (ADR 0018,
> Modell 1a — Kinder definieren die Sektionen). Spiegel zu `ui-tabs.tests.md`.

Spec: `tests/e2e/nodes/view/ui-accordion.spec.ts`
Unit: `packages/runtime/test/p169-accordion-children-model.test.ts`,
`packages/runtime/test/p85-navigation-nodes-behaviour.test.ts` (mapConfig/Verben)
Editor-Regression: `tests/e2e/nodes/editor/navigation-nodes.spec.ts`,
`tests/e2e/nodes/editor/minimal-coverage.spec.ts`

## Zielmodell (P169, ADR 0018)
- **Kein `sections`-JSON-Feld mehr.** Die Sektionen werden aus den gemounteten
  `ui-accordion-section`-Kindern abgeleitet — ein Panel je Kind, Slot-Schlüssel = Kind-id.
- `ui-accordion-section` ist ein dünner Container (`label`/`icon`/`order` +
  Default-`content`-Slot). Mount in ein `ui-accordion`
  (`ui-accordion:<id>/content`, Picker-Alias `container:<id>/content`) = „werde eine
  Sektion". Inhalt mountet in `ui-accordion-section:<sectionId>/content`.
- `openSection` (zweiseitig, analog `ui-tabs` `activeTab`) trägt die **Kind-id**;
  Default = erstes Kind nach `order`; ungültiger Wert → erstes Kind.
- Eindeutigkeit: doppelte Sektions-id unter einem `ui-accordion` → sichtbarer Deploy-Fehler.
- Migration: Legacy `sections:[{id,label}]` + `section:<id>`-Mounts →
  `ui-accordion-section`-Kinder + `ui-accordion-section:<id>/content`-Mounts
  (verlustfrei, einmalig beim Deploy).

## E2E-Tests (`ui-accordion.spec.ts`)
| ID | Ziel |
|---|---|
| R01 | Zwei `ui-accordion-section`-Kinder rendern als `sl-details`-Panels (Summary = Label). |
| R02 | Inhalt jeder Sektion rendert in ihr eigenes Panel; offene Sektion zeigt ihn. |
| O01 | `openSection` Literal-Binding markiert die passende Sektion offen (`open`). |
| O02 | `openSection` State-Binding löst die offene Sektion aus dem Store auf. |
| O03 | Externe Store-Änderung → SSE-Re-Render öffnet die Sektion (Browser-Beweis). |
| D01 | Ohne `openSection` → erstes Kind nach `order` ist offen. |
| S01 | `multiple:false` (Default, Single-Open): Öffnen einer Sektion schließt die offene Schwester (gemessen am `open`-Zustand der `sl-details`). |
| S02 | `multiple:true` (Multi-Open): Öffnen einer Sektion lässt die offene Schwester offen (beide `open`). |
| E01 | `sectionOpen`: eine Sektion aufklappen → POST `/event` `{ event:"sectionOpen", params.sectionId }` (gemessenes Envelope, echte Klick-Geste). |
| E02 | `sectionClose`: eine Sektion zuklappen → POST `/event` `{ event:"sectionClose", params.sectionId }` (gemessenes Envelope). |
| M01 | Legacy `sections`-JSON-Flow migriert: Sektionen + Inhalt rendern weiterhin. |

### Single-Open / Multi-Open (P247)

`multiple` ist **implementiert** (Owner-Entscheid P247): der Serializer trägt die
Accordion-Knoten-id (`data-webapp-source`) und den `multiple`-Schalter
(`data-webapp-accordion-multiple`) auf den `.webapp-accordion`-Wrapper; das
Client-Bundle koordiniert Single-Open — bei `multiple:false` schließt das Öffnen
einer Sektion (`sl-show`) die offenen Schwestern **desselben** Accordions (auf
diesen einen Wrapper begrenzt), das Schließen einer Schwester feuert deren eigenes
`sl-hide` → `sectionClose`. `sl-details` sind nativ unabhängig — die Koordination
lebt im Client, nicht im Markup. Beide Richtungen sind per gemessenem DOM belegt
(S01/S02).

### Events (P247)

`sectionOpen`/`sectionClose` werden aus den echten `sl-show`/`sl-hide`-Gesten
gefeuert; E01/E02 messen das an die Runtime gelieferte Event-Envelope
(`event` + `params.sectionId`). Das Output-`msg.ui`-Envelope (event, params.sectionId,
clientId, sourceId, appId + Port-Routing) ist zusätzlich unit-belegt in
`packages/runtime/test/p85-navigation-nodes-behaviour.test.ts` (§12/§13).

## Unit-Tests (`p169-accordion-children-model.test.ts`)
- Ein `sl-details` je `ui-accordion-section`-Kind; Inhalt im Panel.
- `openSection` markiert das Kind offen; ungültiger Wert → erstes Kind (Fallback);
  ohne Wert → erstes Kind nach `order`.
- `container:<id>/content`-Mount-Alias des Pickers wird akzeptiert.
- Migration (`migrateLegacyAccordionComponents`): synthetisiert
  `ui-accordion-section`-Kinder, hängt `section:<id>`-Inhalts-Mounts um, lässt
  Kinder-Modell unverändert, rendert E2E.
- Eindeutigkeit (`validateUiAccordionSectionChildrenUniqueness`): doppelte id pro
  `ui-accordion` → ein Issue je Knoten; gleiche id unter verschiedenen
  `ui-accordion` ist erlaubt.

## Schema-Unit (`packages/schema/test/schema.test.ts`, P169-Block)
- `ui-accordion-section` kompiliert (label-Binding, optionales icon, order, content-Slot).
- `label` ist Pflicht; `mount`/`app` ist Pflicht.
- `uiAccordionSectionContentMount` / `validateUiAccordionChildrenUnique` /
  `defaultOpenSectionId` / `migrateUiAccordionToChildren` (Round-trip, ids eindeutig,
  Default = erstes nach `order`).
- `ui-accordion` kompiliert ohne `sections`-Feld (Kinder-Modell).

## Dynamisch (P170)
- `ui-repeat` (Template = `ui-accordion-section`, `label = item.<feld>`) → N
  Sektionen aus Daten; keyed, stabil über Datenänderungen. **Nicht in P169.**

## Dynamische Sektionen via ui-repeat (P170, ADR 0017 × 0018) — abgedeckt

> Spiegelt P170 für ui-accordion: ein `ui-repeat` (Schablone = ein einzelnes
> `ui-accordion-section`, `label = item.<feld>`), in ein `ui-accordion` gemountet,
> rendert N Sektionen — eine je Datenzeile. Kein eigener Dynamik-Mechanismus,
> reine Komposition aus ui-repeat (ADR 0017) + Kinder-definieren-Sektionen
> (ADR 0018).
>
> - Renderer-Unit: `packages/renderer/test/p170-dynamic-tabs-sections.test.ts`.
> - Voller Pipeline-Render (HTML): `packages/runtime/test/p170-dynamic-tabs-sections.test.ts`.
> - Browser-Beweis: `tests/e2e/nodes/view/dynamic-tabs-sections.spec.ts`
>   (S01 N Sektionen aus Store-Array + Inhalt je Item-Scope; S02 Löschen keyed).

- **Komposition statt Mechanismus:** `renderAccordion` zählt die Sektions-Kinder
  über `resolveSectionChildren` auf — ein direkt gemountetes
  `ui-accordion-section` ist statisch, ein gemountetes `ui-repeat` wird je Item in
  genau eine keyed Sektion expandiert (Per-Instanz-Id `<itemKey>#<templateId>`).
- **Keying/Stabilität:** Array-Änderung formt die sichtbare Sektions-Menge um,
  unveränderte Sektionen behalten ihre Id; der offene-Sektion-Zustand bleibt
  gültig, solange seine Zeile existiert, sonst Fallback auf die erste Sektion.
- **Label/Inhalt im Item-Scope:** `label` und Inhalt lösen gegen den
  `{item,index}`-Frame der Zeile auf (`item.<feld>`).
