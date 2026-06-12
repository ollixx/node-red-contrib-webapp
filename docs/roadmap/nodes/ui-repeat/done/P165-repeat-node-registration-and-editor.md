---
id: P165
node: ui-repeat
epic: nodes/ui-repeat
title: "ui-repeat Node + Editor: Registrierung, Default-Slot als Template, items-typedInput + keyField; End-to-End-Beweis"
findings:
  - "Owner-Idee (2026-06-11): Ein Knoten ui-repeat mit Default Slot als Container; Kinder binden relativ zum Kontext. Die wiring Lösung: beim Empfangen einer Liste/Object die items rendern."
  - "Owner-Entscheidung (2026-06-12): zwei Knoten — ui-list bleibt das Blatt-Widget, ui-repeat ist das generische Template-Primitiv (Decision A)."
acceptance:
  - "ui-repeat ist im Node-RED-Editor anlegbar und registriert (nodes/view/); items-typedInput (Wert-Bindings) + keyField-Feld + Mount-Picker sichtbar."
  - "Der Default-Slot nimmt Kind-Knoten auf: ein Kind lässt sich in den ui-repeat-Slot mounten (Mount-Picker zeigt den Repeat-Slot)."
  - "Editor bietet die Binding-Art item/index in den typedInputs der Kinder an (oder dokumentierter manueller Weg), und warnt bei item/index-Gebrauch außerhalb eines Repeats."
  - "End-to-End (browser): ein Store-Array [{name:'A'},{name:'B'}] + ui-repeat mit ui-text-Kind (text = item.name) rendert zwei Zeilen 'A','B'; Hinzufügen eines dritten Items rendert sichtbar eine dritte Zeile (keyed, ohne Flackern der ersten beiden)."
verify: browser
spec: docs/nodes/display/ui-repeat.md
tests: tests/e2e/nodes/view/ui-repeat.tests.md
dependencies: [P164]
status: done
---
# P165 — ui-repeat Node-Registrierung + Editor

> Dritte Schicht (ADR 0017). Knoten-Registrierung (`nodes/view/ui-repeat.{js,html}`)
> + Editor-UI; schließt die Welle mit dem **browser**-Beweis ab. Setzt auf
> P163 (Schema) + P164 (Renderer) auf.

## Umfang

1. **Registrierung:** `nodes/view/ui-repeat.js` + `.html`, eingetragen im
   `node-red.nodes`-Block und in `nodes/webapp.js` (Config → Schema-Definition,
   Message-Routing wie ui-list: `msg.payload` setzt `items`).
2. **Default-Slot als Template:** der Knoten ist Container-fähig; Kinder mounten in
   seinen Default-Slot (`installReferenceSelectors`/Mount-Picker zeigt den Slot).
3. **Editor-Felder:** `items`-typedInput (Wert-Bindings), `keyField`-Textfeld,
   Mount-Picker, Basis-Felder (P139/ADR 0015 — Anwendbarkeit klären: Container →
   `visible` anwendbar).
4. **item/index im Editor:** die scope-lokale Binding-Art in den Kinder-typedInputs
   anbieten; bei Gebrauch **außerhalb** eines Repeats eine Editor-Warnung
   (deploy-blockierend? — mind. sichtbarer Hinweis).
5. **Beispiel/Doku:** Spec `docs/nodes/display/ui-repeat.md` final mit dem
   gebauten Stand abgleichen; Testkatalog befüllen.

## acceptance / verify

- `verify: browser` — jede acceptance-Zeile im laufenden Frontend beweisen
  (`preview_*` / Playwright). Der End-to-End-Render-Beweis ist die Kern-Zeile.
- E2E-Verifikation **im Haupt-Checkout** durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]; Build vor E2E,
  [[e2e-verify-build-and-no-tail]]).

## Risiken / Hinweise

- **Stufe 1 read-only** — kein Schreiben aus der Zeile (Stufe 2, ADR 0017 §5).
- `examples/customers-crud/flow.json` ist generiert — falls ein Repeat-Beispiel
  aufgenommen wird, nur via `pnpm gen:example`, nie von Hand.

## Result

- **delivered:** ui-repeat-Welle (ADR 0017) Schicht 3 — node registration + editor + the **browser
  proof**, closing the wave. Registration: `nodes/view/ui-repeat.{js,html}` + the `node-red.nodes`
  block + `nodes/webapp.js` (`kind:"repeat"`, `bind.items`, `props.keyField`; `msg.payload` sets
  `items` like ui-list, via `viewNodePatchInputHandler`). Container-capable: ui-repeat is exposed to
  both mount pickers (`buildMountOptionsTree` + `buildMountPickerTree`) with a fixed single `content`
  slot (`REPEAT_SLOT`); children mount `container:<id>/content`. Editor: `items` value typedInput,
  `keyField` text field, mount-picker, and `installBaseFields` (visible applicable; disabled/color/
  size N/A with hints). `item`/`index` added as scope-local typedInput kinds (tail of the canonical
  value set, excluded from boolean/url categories), round-tripped via applyValueBinding/
  readValueBinding, with `installRepeatScopeHint` warning (visible, non-blocking) on use outside a
  repeat. Consumed (not redefined) the P163 schema + P164 renderer. Spec `docs/nodes/display/ui-repeat.md`
  finalized; catalogue filled.
- **stats:** 11 files (4 new), +594/−16. `pnpm validate` green (check:roadmap + check:links + lint +
  1054+ unit tests + build). Develop verification: `pnpm build` exit 0; **ui-repeat browser proof
  2/2** (store array renders one row per item via `item.name`; adding a third item keyed-renders a
  visible third row, first two not re-mounted); the **full editor suite 131/131** green after the
  follow-up fix (the pre-existing `p69-icon-picker` flake passed this run).
- **notes:** **Orchestrator follow-up fix (`fix/P165-canonical-value-set`, test-only):** adding
  `item`/`index` to the global canonical value set broke `p67-alert-binding.spec.ts`'s exact-set
  assertion. Confirmed via ADR 0017 §3 + the P165 acceptance that global-availability-with-out-of-
  repeat-warning is the intended design (the editor can't know mount-ancestry at edit time), so the
  fix updated the pinned assertion to the full new 16-member set (kept full, not weakened); the two
  sibling assertion specs (`store-binding-subpath` pins the storePath category which excludes
  item/index by design; `reactive-expression` pins no full set) needed no change. Re-verified 18/18
  across the 4 specs. **Stage-1 read-only** (no row write-back — ADR 0017 §5). **The ui-repeat wave
  (P163 schema + P164 renderer + P165 node/editor) is complete.**
- **cost:** session af1ebea39750224db (~28m) + fix session ae251e146e1f40174 (~3m); plus
  orchestrator develop-E2E (editor-suite verification on a slow host).
