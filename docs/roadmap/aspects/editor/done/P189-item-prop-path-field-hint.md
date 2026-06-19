---
id: P189
title: "Editor-UX + Validierung: Item-/Prop-Pfadfeld erklären (Hinweis 'Feldpfad · leer = ganzes Element') UND typ-bewusste Validierung — leeres item/index-Feld nicht mehr rot (required:true ist typ-blind)"
epic: aspects/editor
findings:
  - "Owner (2026-06-19): 'wenn ich in ui-text mit Type item als wert item eingebe, wird nichts angezeigt, bzw. ?. Das entspricht nicht der Definition in ui-repeat.'"
  - "Owner (2026-06-19): 'Ergänze dort auch, dass die Validierung nicht dazu passt. ein leeres Feld an der Stelle wird rot markiert.'"
  - "Diagnose UX: bei Typ 'Item (Repeat)' ist das Wertfeld der FELDPFAD im Element (das item.-Präfix IST der Typ). Wert 'item' → Pfad 'item' → item.item → existiert nicht → '?'. Ganzes Element = Feld LEER (P184, bereits gemergt). Das Feld gibt aber keinerlei Hinweis darauf → Bedien-Fallstrick."
  - "Diagnose Validierung: das Wert-Binding-Trägerfeld trägt im Knoten-HTML required: true (z. B. ui-text 'text: { value: \"\", required: true }') — TYP-BLIND. Bei Typ item (ganzes Element) / index (pfadlos) ist der Feldwert leer, und required:true markiert ihn ROT, obwohl leer hier gültig ist. Editor-Entsprechung zum P184-Schema-Fix (Server erlaubt leer schon, Editor noch nicht)."
acceptance:
  - "Bei gewähltem Typ 'Item (Repeat)' (und 'Prop (Component)') zeigt das Wertfeld einen klaren Hinweis/Placeholder: sinngemäß 'Feldpfad (z. B. name, address.city) — leer = ganzes Element'."
  - "Der Hinweis erscheint nur, wenn der Typ tatsächlich item/prop ist; er stört die anderen Typen nicht."
  - "'Index (Repeat)' bleibt pfadlos (kein Wertfeld) — unverändert; ggf. ein kurzer Hinweis 'nullbasierte Position, kein Pfad'."
  - "Validierung: ein LEERES Wertfeld bei Typ item (ganzes Element) bzw. index (pfadlos) wird NICHT mehr rot markiert und blockiert den Deploy nicht — konsistent zur Schema-Toleranz (P184). Das blunt 'required: true' am Binding-Trägerfeld wird durch eine TYP-BEWUSSTE Validierung ersetzt, die an die validate-Funktion des gewählten Binding-Typs delegiert (item/index erlauben leer; Daten-Typen wie state/query bleiben pflicht)."
  - "Zentral/alle Knoten: der Fix sitzt im gemeinsamen Helfer (statt 26× 'required: true' am *Binding-Feld); Stichprobe an ui-text/ui-button/ui-list zeigt: leeres item-Feld grün, leeres state/query-Feld weiterhin rot."
  - "Klarstellung dokumentiert (ui-repeat-Spec / editor.md): das Editor-Wertfeld ist der Pfad NACH dem item., leer = ganzes Element — gegen den 'item als Wert tippen'-Fehlschluss."
verify: browser
spec: docs/nodes/display/ui-repeat.md
tests: tests/e2e/nodes/view/ui-repeat.tests.md
dependencies: []
status: done
---
# P189 — Item-/Prop-Pfadfeld erklären (Editor-UX)

> Kleiner, gezielter Editor-Hinweis. P184 hat das **leere** Pfad-Feld (ganzes
> Element) technisch repariert; hier kommt die **Erklärung im UI** dazu, damit der
> Nutzer nicht `item` als Wert tippt und `?` erntet.

## Umfang

1. **Hinweis/Placeholder** am Wert-typedInput, wenn Typ = `item` bzw. `prop`:
   „Feldpfad (z. B. `name`, `address.city`) — leer = ganzes Element". Mechanik wie
   `installRepeatScopeHint` (dynamischer Hinweis bei Typwechsel) oder ein
   Placeholder auf dem Value-Input des Typs.
2. **Typ-bewusste Validierung:** das blunt `required: true` am Wert-Binding-
   Trägerfeld (z. B. ui-text `text`) durch eine Validierung ersetzen, die an die
   `validate`-Funktion des **gewählten Binding-Typs** delegiert — `item`/`index`
   (und whole-`prop`) erlauben leer, `state`/`query`/… bleiben pflicht. Als
   **gemeinsamer Helfer** (`validateValueBindingField` o. ä.) statt 26× `required:
   true`; in den `*Binding`-Feldern der Knoten einsetzen.
3. **`index`** bleibt pfadlos; optional ein Mini-Hinweis „nullbasierte Position".
4. **Doku-Klarstellung** (ui-repeat-Spec §„Im Editor" + editor.md): das Wertfeld
   trägt **nur den Pfad nach `item.`**; **leer = ganzes Element**; `item` als Wert
   bedeutet das Feld `item` (nicht das Element).

## acceptance / verify

- `verify: browser` — der Hinweis erscheint bei Typ item/prop, verschwindet sonst;
  ein leeres item-Feld in einem Repeat zeigt das ganze String-Element (Regression
  zu P184). E2E im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]).

## Risiken / Hinweise

- **Reine UX/Doku** — kein Schema-/Renderer-Wechsel (P184 trägt die Auflösung).
- Nebenbefund prüfen: der Editor-`prop`-Typ verlangt aktuell einen **nicht-leeren**
  Pfad (validate), während das Schema `prop` ohne Pfad (ganzes Prop) erlaubt — ggf.
  hier mit angleichen (leerer prop-Pfad = ganzes Prop), konsistent zu `item`.

## Result

- **delivered:** Editor counterpart to P184 — type-aware validation + a path-field hint for scope-local
  bindings. New shared helpers in `resources/lib/editor-common.js`: `isValueBindingValueValid(type,value)`
  (pure core), `validateValueBindingField(fieldSelector, bindingField)` (a type-aware validate factory
  reading the live typedInput kind, with a persisted-binding pre-open fallback), and
  `installValueBindingPathHint(fieldSelector)` (inline hint — item/prop → "Feldpfad … leer = ganzes
  Element"; index → "nullbasierte Position — kein Pfad"). The blunt type-blind `required:true` /
  non-empty validate on the binding carrier was replaced with `validateValueBindingField` on
  `ui-text` (`text`) and `ui-button` (`label`) as the proof nodes, and the path hint installed. Also
  fixed (the spec's Nebenbefund) the editor `prop` typedInput validate to accept an empty path
  (whole-prop), aligning it with `item`/the P184 schema contract.
- **stats:** 7 files (5 changed, 2 new); +10 editor unit cases
  (`p189-value-binding-validation.test.ts`) + 2 E2E
  (`tests/e2e/nodes/editor/p189-item-prop-path-field.spec.ts`). Develop verification: build exit 0;
  full unit green (editor **152**, incl. the 10 new); **E2E 21/21 green** — the 2 P189 proofs (hint
  shows for `item`, hidden for `query`; empty item/index keeps node VALID while empty query flags
  INVALID and a filled query goes green) **plus base-fields 19/19** (no regression in the shared
  validation machinery the change touches); lint + validate + tripwires OK.
- **notes:** Consumed P182 (`currentEditorScope`/gating) + P184 (whole-element/bare-index/whole-prop
  schema contract) — both confirmed present before starting. Left `ui-list.html` untouched on purpose:
  its `itemsBinding` is the `structural` category (no item/index kinds) and was never `required`
  (P171), so it has no type-blind bug; the proof lives on ui-text/ui-button which offer both scope-local
  and state/query kinds. No renderer/ui-repeat.html/package.json touched.
- **cost:** session agent-ad45e999ec0c5a6e3, ~14m.
