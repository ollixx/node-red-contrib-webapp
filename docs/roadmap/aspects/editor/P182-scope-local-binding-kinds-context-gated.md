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
status: in_progress
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
