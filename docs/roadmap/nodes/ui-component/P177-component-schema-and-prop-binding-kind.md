---
id: P177
node: ui-component
epic: nodes/ui-component
title: "ui-component: Schema — definition/instance-Knoten + def:-Mount-Scope + scope-lokale Binding-Art prop/prop.<name> + Self-Ref-Validierung"
findings:
  - "Owner-Entscheidung (ADR 0020, 2026-06-14): Components als dedizierter Knoten-Paar (definition/instance), NICHT als Node-RED-Subflow (Spike P166/ADR 0019). Props = benannter Render-Zeit-Scope prop.<name>, exakter Geschwister von ui-repeat item/index (ADR 0017)."
  - "ADR 0020: zwei Vertrags-Ergänzungen — ein neuer Mount-Scope def:<componentId>/content für die Definition-Kinder, und eine neue scope-lokale Binding-Art prop (+ prop.<name>) im Binding-Union."
acceptance:
  - "Schema validiert eine ui-component-definition-Knotendefinition: Container-Kind (Kinder erlaubt, analog ui-container/ui-repeat), fester Default-Slot content (exportiert als COMPONENT_DEF_SLOT); kein outer mount nötig (off-canvas) — Fixtures grün."
  - "Schema validiert eine ui-component-instance-Knotendefinition: leaf-förmig mit outer mount/parent (in eine echte Route/Container), Pflichtfeld definitionId (String, referenziert eine Definition), und props als Map name→Wert-Binding (jede Binding-Art) — Fixtures grün."
  - "Mount-Grammatik: parseMountReference akzeptiert def:<id>/<slot> als zusätzlichen Scope (Geschwister zu route:/dialog:/layout:/container:); ein def:-Mount parst/serialisiert verlustfrei; ein Mount mit unbekanntem Scope bleibt rot."
  - "Binding-Union: prop und prop.<pfad> (ein-/mehrstufiger Punktpfad wie item.<pfad>) sind als scope-lokale Arten zugelassen (SCOPE_LOCAL_BINDING_KINDS), schema-validierbar und round-trippen durch parse/serialize; index-/item-Verhalten unverändert. Reine FORM-Validierung — Auflösung erst im Renderer (P177)."
  - "Self-Reference-Validierung (reine Funktion, unit-getestet): eine Definition, die sich selbst (direkt oder transitiv über eine Instanz in ihrem Subtree) instanziiert, ist ungültig (klare Fehlermeldung); ein azyklischer Definition→Instance→Definition-Graph ist gültig."
  - "Negativ: eine props-Map mit unbekannter Binding-Art bleibt rot; das Schema importiert weiterhin aus keinem anderen Repo-Paket (Invariante)."
verify: unit
spec: docs/nodes/structure/ui-component.md
tests: tests/e2e/nodes/view/ui-component.tests.md
dependencies: []
status: in_progress
---
# P177 — ui-component: Schema + def:-Scope + prop-Binding-Art

> Erste Schicht von [ADR 0020](../../../adr/0020-component-model-dedicated-ui-component-node.md).
> Rein in `packages/schema` (Knotendefinitionen + Mount-Grammatik + Binding-Union
> + Validierung). **Kein Renderer, kein Editor, keine Node-Registrierung** (P177/P178).
> Reuse: die scope-lokale Binding-Mechanik aus [ADR 0017](../../../adr/0017-ui-repeat-template-container-render-time-scope.md)
> (`item`/`index`) — `prop` ist deren direkter Geschwister.

## Umfang

1. **Knoten `ui-component-definition`** (Zod): Container-fähig (Kinder erlaubt,
   wie `ui-container`/`ui-repeat` registriert), fester Default-Slot `content`
   (Konstante `COMPONENT_DEF_SLOT = "content"`). **Off-canvas:** kein realer outer
   mount erforderlich (die Definition rendert nie selbst). `name`/Identität trägt
   die Node-id als `componentId`.
2. **Knoten `ui-component-instance`** (Zod): leaf-förmig (keine Kinder), **outer
   `mount`/`parent`** in eine echte Route/Container (Pflicht, wie jeder gemountete
   Knoten), Pflichtfeld **`definitionId`** (String), **`props`** = Map `name → Wert-
   Binding` (jede Binding-Art; optional leer).
3. **Mount-Scope `def:`** in `parseMountReference` (`packages/schema/src/validation.ts`):
   `def:<componentId>/<slot>` als zusätzlicher Scope neben `route:`/`dialog:`/
   `layout:`/`container:`. Reine Grammatik-Erweiterung; Serialisierung des Mount-
   Strings unverändert in Form.
4. **Binding-Art `prop` / `prop.<name>`** in den Binding-Union + `SCOPE_LOCAL_BINDING_KINDS`
   (`packages/schema/src/contracts.ts`): `prop` → ganzer Prop-Wert; `prop.<pfad>`
   → ein-/mehrstufiger Feldpfad (konsistent mit `item.<pfad>`, ADR 0017/0013 — reine
   Pfad-Validierung, kein Slice-Zwang). **Scope-lokal markiert** — nur FORM
   validieren, **nicht** auflösen (das ist P177).
5. **Self-Reference-Validierung** als reine Funktion (z. B. `validateComponentAcyclic`):
   ein Definition→Instance-Graph wird auf Zyklen geprüft (Definition referenziert
   sich selbst direkt oder transitiv) → Fehler mit sprechender Meldung; azyklisch →
   gültig.
6. **Fixtures** für ein minimales Component-Paar (eine Definition mit einem
   `ui-text`-Kind `text = prop.title`; eine Instanz mit `props = { title: "A" }`).

## acceptance / verify

- `verify: unit` — Schema-/Validierungs-/Mount-Grammatik-Tests in `packages/schema/test`.

## spec / tests

- spec: **neu** `docs/nodes/structure/ui-component.md` anlegen (Definition/Instance,
  Felder, `def:`-Mount, `prop`-Binding, Self-Ref-Regel, v1-Cut nach ADR 0020).
- tests: **neu** `tests/e2e/nodes/view/ui-component.tests.md` (Katalog; Schema-
  Abschnitt als unit markiert).

## Risiken / Hinweise

- **Invariante:** `packages/schema` importiert aus keinem anderen Repo-Paket.
- `prop.name` korrekt als zweistufiger Feldpfad akzeptieren (`prop.` ist die ART,
  der Rest der Pfad) — analog zur P163-Klärung für `item.name`.
- **Kein** Renderer-/Editor-/Node-Registrierungs-Code hier — das sind P177/P178.
  Die Auflösung von `prop`/`index`/`item` ist ausdrücklich **nicht** hier.
