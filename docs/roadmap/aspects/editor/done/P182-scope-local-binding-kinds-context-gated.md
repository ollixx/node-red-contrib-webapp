---
id: P182
title: "Scope-lokale Binding-Arten (item/index, prop) nur im Scope anbieten: item/index nur unter ui-repeat, prop nur in einer Component-Definition — sonst aus dem typedInput-Set ausblenden"
epic: aspects/editor
findings:
  - "Owner (2026-06-14): 'bei Color fällt auf, dass da jetzt die Types Item (Repeat) und Index (Repeat) auftauchen. Ist das richtig da? Das wäre nur sinnvoll, wenn die ui-list innerhalb eines Repeats wäre, korrekt? Und da wir das nicht wissen, muss das da immer auftauchen?'"
  - "Befund: valueBindingTypes legt item/index (und prop) bedingungslos ins value-Set → sie erscheinen in JEDEM Wert-Feld aller Knoten. Einziger Schutz heute: installRepeatScopeHint (advisory). ABER der Kontext ist bekannt: mountIsInsideRepeat(mount, references) (editor-common.js ~Z.1017) liefert, ob der Knoten transitiv unter einem ui-repeat hängt."
acceptance:
  - "item/index erscheinen im typedInput-Typenset NUR, wenn der Knoten (transitiv) unter einem ui-repeat hängt (mountIsInsideRepeat true) ODER das Feld aktuell bereits ein item/index-Binding trägt (Editierbarkeit bestehender Configs)."
  - "prop (Component) erscheint NUR, wenn der Knoten in einer ui-component-Definition hängt ODER das Feld bereits ein prop-Binding trägt."
  - "Außerhalb des Scopes sind item/index/prop NICHT im Dropdown — Stichprobe an color/visible-Wertfeldern eines NICHT-eingebetteten ui-list/ui-text/ui-button zeigt das bereinigte Set."
  - "Innerhalb eines ui-repeat zeigt dasselbe Feld item/index wieder an (Beweis: gleiches Feld, einmal frei, einmal im Repeat gemountet)."
  - "Der installRepeatScopeHint bleibt als Backstop für den Fall 'Binding gesetzt, dann aus dem Repeat gezogen'."
verify: browser
spec: docs/nodes/concepts/editor.md
tests: tests/e2e/nodes/view/ui-repeat.tests.md
dependencies: []
status: done
---
# P182 — Scope-lokale Binding-Arten kontext-gated anbieten

> `item`/`index` (ADR 0017) und `prop` (ADR 0020) sind **scope-lokal** — sie lösen
> nur im jeweiligen Container auf. Heute stehen sie in **jedem** Wert-Feld; das ist
> Rauschen und verwirrt (Owner-Beobachtung an `color`). Der Editor **kennt** den
> Scope (`mountIsInsideRepeat`), nutzt ihn nur noch nicht zum Filtern.

## Umfang

1. **`valueBindingTypes` kontextfähig machen:** ein optionaler Kontext, der die
   scope-lokalen Arten gated — z. B. `valueBindingTypes({ category, scope: {
   repeat: bool, componentDef: bool }, currentKind })`:
   - `item`/`index` nur aufnehmen, wenn `scope.repeat` **oder**
     `currentKind ∈ {item,index}`.
   - `prop` nur, wenn `scope.componentDef` **oder** `currentKind === "prop"`.
2. **Scope zentral ermitteln:** `mountIsInsideRepeat(mount, references)` existiert
   bereits; das Pendant für die Component-Definition (`def:`/COMPONENT_DEF_SLOT)
   ergänzen, falls nicht vorhanden (`mountIsInsideComponentDef`).
3. **Aufrufer versorgen:** die gemeinsamen Installer (`installBaseFields` color,
   der geteilte Wert-Feld-Pfad) und die bespoke Per-Node-Setups (items,
   currentPage, label, …) übergeben Mount/Parent + References + den aktuellen
   Feld-Kind. Sweep über alle `valueBindingTypes({category:"value"|"boolean"|…})`-
   Aufrufe.
4. **Backstop behalten:** `installRepeatScopeHint` bleibt (Fall: Binding gesetzt,
   Knoten später aus dem Repeat gezogen → Typ via currentKind noch sichtbar +
   Hinweis).

## acceptance / verify

- `verify: browser` — frei gemountetes Feld ohne item/index/prop; dasselbe Feld
  unter ui-repeat MIT item/index. E2E im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]).

## Risiken / Hinweise

- **Re-open-Caveat:** ändert man den Mount nachträglich in einen Repeat hinein,
  erscheint der Typ erst beim erneuten Öffnen des Panels (oneditprepare baut das
  Set). Dokumentieren; die `currentKind`-Ausnahme verhindert Datenverlust.
- Breiter Sweep, aber **eine** Logikquelle (valueBindingTypes + ein Scope-Helfer);
  kein Schema-/Renderer-/Modellwechsel — reine Editor-Typenliste.
- `boolean`/`url`/`storePath`/`structural`-Kategorien führen item/index/prop
  ohnehin nicht (bzw. nur value/structural) — prüfen, dass nur die betroffenen
  Kategorien angefasst werden.

## Result

- **delivered:** Scope-local binding kinds are now **context-gated** in the editor's typedInput
  offering. `valueBindingTypes()` takes a `scope { repeat, componentDef }` + `currentKind`; when scope
  is omitted it auto-derives from the live edit form via `mountIsInsideRepeat` and a new
  `mountIsInsideComponentDef` analogue (both exported, alongside `currentEditorScope`). `item`/`index`
  are offered ONLY when the edited node is mounted inside a `ui-repeat`; `prop` ONLY inside a
  `ui-component-definition` (`def:` scope); outside both, none appear — the field shows the base
  value set. `currentKind` re-includes an already-saved kind so existing bindings stay editable even
  if the node is later viewed out of scope. All value/display value-field installers (incl.
  `installBaseFields` colour + every ui-* node HTML) pass `currentKind`. `installRepeatScopeHint`
  kept as a backstop. Documented in `docs/nodes/concepts/editor.md`.
- **stats:** 33 files (impl) + 1 test-fix commit. Unit **1651 passed** (editor 136, incl. 18 new P182
  cases for the helpers + gating + currentKind; updated the p113 canonical set to the gated base set).
  E2E: new `tests/e2e/nodes/editor/p182-scope-local-binding-gating.spec.ts` (4 tests) — item/index in
  a repeat, prop in a def, neither outside both, and the SAME field re-gating purely by mount context.
  Develop verification: build exit 0; full editor E2E folder green (157/157 after the fix); the 4
  gating tests + the 3 p67 tests **7/7 green**; lint + validate + both tripwires OK.
- **notes:** Chose single-source auto-derivation inside `valueBindingTypes` over threading explicit
  `scope` through ~44 call sites (the sweep only injects `currentKind`). **This phase also resolved a
  pre-existing develop failure:** `p67-alert-binding`'s "canonical value set" test was red because the
  Components P177–P179 wave had added `prop` to the global typedInput set; P182 corrects that test to
  the gated base set (ui-alert is neither in a repeat nor a def → no `prop`/`item`/`index`).
  **Orchestrator follow-up fix** (`phase/P182`, commit `498c222`, test-only): the new line-126
  re-gating test was authored with two `deployFlow` calls but no editor reload between them, so the
  panel bound to the stale free-mounted node and (correctly) derived "not in a repeat" — added a
  reload before the re-open; the implementation derivation was correct and the assertion was NOT
  weakened. CONSUMED helper `mountIsInsideRepeat` confirmed present before starting.
- **cost:** session agent-acb1a7330743ac2b7 (~17m) + fix session a6a9d9f3a1447896f (~7m) +
  orchestrator editor-folder E2E gate.
