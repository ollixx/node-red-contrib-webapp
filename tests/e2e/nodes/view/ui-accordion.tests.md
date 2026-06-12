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
| M01 | Legacy `sections`-JSON-Flow migriert: Sektionen + Inhalt rendern weiterhin. |

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
- `label` ist Pflicht; `mount`/`parent` ist Pflicht.
- `uiAccordionSectionContentMount` / `validateUiAccordionChildrenUnique` /
  `defaultOpenSectionId` / `migrateUiAccordionToChildren` (Round-trip, ids eindeutig,
  Default = erstes nach `order`).
- `ui-accordion` kompiliert ohne `sections`-Feld (Kinder-Modell).

## Dynamisch (P170)
- `ui-repeat` (Template = `ui-accordion-section`, `label = item.<feld>`) → N
  Sektionen aus Daten; keyed, stabil über Datenänderungen. **Nicht in P169.**
